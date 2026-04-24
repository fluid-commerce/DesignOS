#!/usr/bin/awk -f
# ocr-to-blocks.awk — Post-process tesseract TSV output into compact block summaries.
#
# PSM SELECTION RATIONALE (tested on 3 confirmed samples × PSM 3/6/7/11/12):
#   WINNER: PSM 3 (fully automatic) — best zone-aware block separation across all types:
#     - Text-heavy (Healing Quote): captured eyebrow metadata + headline block clearly
#     - Photo-heavy (Photo Collage): correctly returned near-empty (no text) signal
#     - Carousel cover (How-to): only PSM 3 cleanly separated top label from headline zone
#   PSM 11 (sparse text) merged all content into one giant block on text-heavy images
#   PSM 6 (uniform block) over-merged; produced single 1113px-wide block spanning zones
#   PSM 7 (single line) missed multi-line blocks entirely — returned no text
#   PSM 12 (sparse+OSD) introduced auto-rotation noise that displaced zone assignment
# CANONICAL COMMAND: tesseract "$IMG" - --psm 3 -c tessedit_create_tsv=1 2>/dev/null
#
# THRESHOLDS:
#   conf < 60 → filtered (handwritten/decorative fonts OCR as garbage below this)
#   height < 20px → filtered (artifacts, hairlines)
#   vertical gap > 120px → block break (separates headline from body from footer zones)
#
# ZONE ASSIGNMENT (based on canvas height):
#   top      = y+h <= H * 0.33
#   mid      = y+h > H * 0.33 and y < H * 0.67
#   bottom   = y >= H * 0.67
#   left     = center_x <= W * 0.4
#   center   = center_x > W * 0.4 and center_x < W * 0.6
#   right    = center_x >= W * 0.6
#
# OUTPUT FORMAT (one line per block):
#   canvas {W}x{H}
#   block {N} "{text}" zone={zone} bbox={x},{y},{w},{h} fontsize≈{h} conf={avg_conf}
#
# USAGE:
#   awk -v W=$W -v H=$H -f tools/ocr-to-blocks.awk /tmp/ocr.tsv > /tmp/blocks.txt

BEGIN {
    FS = "\t"
    CONF_THRESHOLD = 60
    HEIGHT_THRESHOLD = 20
    GAP_THRESHOLD = 120   # px gap between lines to form a new block

    block_count = 0
    line_count = 0

    # Print canvas header
    if (W && H) print "canvas " W "x" H
}

# Skip header row
NR == 1 { next }

{
    # TSV columns: level page_num block_num par_num line_num word_num
    #              left top width height conf text
    level = $1
    left  = $5+0   # actually: left in col 7 for word-level
    top   = $6+0
    wid   = $7+0
    ht    = $8+0
    conf  = $9+0
    text  = $10

    # tesseract TSV: col indices (1-based)
    # 1=level 2=page_num 3=block_num 4=par_num 5=line_num 6=word_num
    # 7=left  8=top       9=width    10=height  11=conf    12=text
    left  = $7+0
    top   = $8+0
    wid   = $9+0
    ht    = $10+0
    conf  = $11+0
    text  = $12

    # Filter: word-level rows only (level==5), skip empty/low-conf
    if ($1 != 5) next
    if (conf < CONF_THRESHOLD) next
    if (ht < HEIGHT_THRESHOLD) next
    if (text == "") next

    # Accumulate words into lines
    line_count++
    lines_text[line_count] = text
    lines_left[line_count] = left
    lines_top[line_count]  = top
    lines_w[line_count]    = wid
    lines_h[line_count]    = ht
    lines_conf[line_count] = conf
}

END {
    if (line_count == 0) {
        print "block 0 \"(no text detected above threshold)\" zone=unknown bbox=0,0,0,0 fontsize≈0 conf=0"
        exit
    }

    # Group lines into blocks by vertical proximity
    # A new block starts when gap to previous line > GAP_THRESHOLD
    b = 1
    blk_texts[1]    = lines_text[1]
    blk_left[1]     = lines_left[1]
    blk_top[1]      = lines_top[1]
    blk_right[1]    = lines_left[1] + lines_w[1]
    blk_bottom[1]   = lines_top[1]  + lines_h[1]
    blk_maxh[1]     = lines_h[1]
    blk_conf_sum[1] = lines_conf[1]
    blk_conf_n[1]   = 1

    prev_bottom = lines_top[1] + lines_h[1]

    for (i = 2; i <= line_count; i++) {
        gap = lines_top[i] - prev_bottom
        if (gap > GAP_THRESHOLD) {
            b++
            blk_texts[b]    = lines_text[i]
            blk_left[b]     = lines_left[i]
            blk_top[b]      = lines_top[i]
            blk_right[b]    = lines_left[i] + lines_w[i]
            blk_bottom[b]   = lines_top[i]  + lines_h[i]
            blk_maxh[b]     = lines_h[i]
            blk_conf_sum[b] = lines_conf[i]
            blk_conf_n[b]   = 1
        } else {
            blk_texts[b] = blk_texts[b] " " lines_text[i]
            if (lines_left[i] < blk_left[b])   blk_left[b]   = lines_left[i]
            if (lines_left[i]+lines_w[i] > blk_right[b]) blk_right[b] = lines_left[i]+lines_w[i]
            if (lines_top[i]+lines_h[i] > blk_bottom[b]) blk_bottom[b] = lines_top[i]+lines_h[i]
            if (lines_h[i] > blk_maxh[b]) blk_maxh[b] = lines_h[i]
            blk_conf_sum[b] += lines_conf[i]
            blk_conf_n[b]++
        }
        prev_bottom = lines_top[i] + lines_h[i]
    }

    # Output blocks
    for (k = 1; k <= b; k++) {
        cx = (blk_left[k] + blk_right[k]) / 2
        cy = (blk_top[k]  + blk_bottom[k]) / 2
        bw = blk_right[k] - blk_left[k]
        bh = blk_bottom[k] - blk_top[k]
        avg_conf = int(blk_conf_sum[k] / blk_conf_n[k])

        # Zone assignment
        if (H > 0) {
            if (blk_bottom[k] <= H * 0.33) vzone = "top"
            else if (blk_top[k] >= H * 0.67) vzone = "bottom"
            else vzone = "mid"
        } else {
            vzone = "mid"
        }

        if (W > 0) {
            if (cx <= W * 0.4) hzone = "left"
            else if (cx >= W * 0.6) hzone = "right"
            else hzone = "center"
        } else {
            hzone = "center"
        }

        zone = vzone "-" hzone

        printf "block %d \"%s\" zone=%s bbox=%d,%d,%d,%d fontsize≈%d conf=%d\n",
            k, blk_texts[k], zone, blk_left[k], blk_top[k], bw, bh, blk_maxh[k], avg_conf
    }
}
