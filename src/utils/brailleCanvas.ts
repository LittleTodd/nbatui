/**
 * Braille Canvas for High-Resolution Sub-Pixel Terminal Graphics
 * 
 * Uses Unicode Braille Patterns (U+2800 - U+28FF).
 * Each character cell is a 2x4 sub-pixel grid:
 * 
 * Dot positions and bit flags:
 * (x=0, y=0): 0x01 (Dot 1)   (x=1, y=0): 0x08 (Dot 4)
 * (x=0, y=1): 0x02 (Dot 2)   (x=1, y=1): 0x10 (Dot 5)
 * (x=0, y=2): 0x04 (Dot 3)   (x=1, y=2): 0x20 (Dot 6)
 * (x=0, y=3): 0x40 (Dot 7)   (x=1, y=3): 0x80 (Dot 8)
 */

export class BrailleCanvas {
    readonly cellWidth: number;
    readonly cellHeight: number;
    readonly pixelWidth: number;
    readonly pixelHeight: number;
    private pixels: Uint8Array;

    constructor(cellWidth: number, cellHeight: number) {
        this.cellWidth = cellWidth;
        this.cellHeight = cellHeight;
        this.pixelWidth = cellWidth * 2;
        this.pixelHeight = cellHeight * 4;
        this.pixels = new Uint8Array(this.pixelWidth * this.pixelHeight);
    }

    clear(): void {
        this.pixels.fill(0);
    }

    setPixel(x: number, y: number, value: boolean = true): void {
        const px = Math.round(x);
        const py = Math.round(y);
        if (px < 0 || px >= this.pixelWidth || py < 0 || py >= this.pixelHeight) {
            return;
        }
        this.pixels[py * this.pixelWidth + px] = value ? 1 : 0;
    }

    getPixel(x: number, y: number): boolean {
        const px = Math.round(x);
        const py = Math.round(y);
        if (px < 0 || px >= this.pixelWidth || py < 0 || py >= this.pixelHeight) {
            return false;
        }
        return this.pixels[py * this.pixelWidth + px] === 1;
    }

    drawLine(x0: number, y0: number, x1: number, y1: number): void {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);

        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.setPixel(x0, y0);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    drawRect(x: number, y: number, w: number, h: number): void {
        this.drawLine(x, y, x + w, y);
        this.drawLine(x + w, y, x + w, y + h);
        this.drawLine(x + w, y + h, x, y + h);
        this.drawLine(x, y + h, x, y);
    }

    drawCircle(cx: number, cy: number, radius: number): void {
        let x = 0;
        let y = Math.round(radius);
        let d = 3 - 2 * radius;

        const plot = (px: number, py: number) => {
            this.setPixel(cx + px, cy + py);
            this.setPixel(cx - px, cy + py);
            this.setPixel(cx + px, cy - py);
            this.setPixel(cx - px, cy - py);
            this.setPixel(cx + py, cy + px);
            this.setPixel(cx - py, cy + px);
            this.setPixel(cx + py, cy - px);
            this.setPixel(cx - py, cy - px);
        };

        plot(x, y);
        while (y >= x) {
            x++;
            if (d > 0) {
                y--;
                d = d + 4 * (x - y) + 10;
            } else {
                d = d + 4 * x + 6;
            }
            plot(x, y);
        }
    }

    drawArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number, stepDeg: number = 2): void {
        for (let angle = startAngle; angle <= endAngle; angle += stepDeg) {
            const rad = (angle * Math.PI) / 180;
            const px = cx + radius * Math.cos(rad);
            const py = cy + radius * Math.sin(rad);
            this.setPixel(px, py);
        }
    }

    /**
     * Renders canvas to string lines where each char is a Braille character
     */
    renderLines(): string[] {
        const lines: string[] = [];

        for (let cy = 0; cy < this.cellHeight; cy++) {
            let row = '';
            for (let cx = 0; cx < this.cellWidth; cx++) {
                const px = cx * 2;
                const py = cy * 4;

                let code = 0;
                if (this.getPixel(px, py)) code |= 0x01;
                if (this.getPixel(px, py + 1)) code |= 0x02;
                if (this.getPixel(px, py + 2)) code |= 0x04;
                if (this.getPixel(px + 1, py)) code |= 0x08;
                if (this.getPixel(px + 1, py + 1)) code |= 0x10;
                if (this.getPixel(px + 1, py + 2)) code |= 0x20;
                if (this.getPixel(px, py + 3)) code |= 0x40;
                if (this.getPixel(px + 1, py + 3)) code |= 0x80;

                row += String.fromCharCode(0x2800 + code);
            }
            lines.push(row);
        }

        return lines;
    }
}
