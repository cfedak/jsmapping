/*
 Copyright (C) 2012 Christopher Fedak (christopher.fedak@gmail.com)

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
 persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */
define(
["geom/point"],
function(Point) {
    var ScaledBitmap = function(data,scaledw,scaledh,w,h) {
        this.data = data;
        this.scaledw = scaledw;
        this.scaledh = scaledh;
        this.w = w;
        this.h = h;
    };

    ScaledBitmap.prototype.forEach = function(f, context) {
        var x;
        var y;
        for (x=0;x<this.scaledw;++x) {
            for (y=0;y<this.scaledh;++y) {
                var val = this.data[x][y];
                if (context) {
                    f.call(context, val,x,y);
                } else {
                    f(val,x,y);
                }
            }
        }
        return this;
    };

    ScaledBitmap.prototype.mapInPlace = function(f, context) {
        var x;
        var y;
        for (x=0;x<this.scaledw;++x) {
            for (y=0;y<this.scaledh;++y) {
                var val = this.data[x][y];
                var newVal;
                if (context) {
                    newVal = f.call(context, val,x,y);
                } else {
                    newVal = f(val,x,y);
                }
                this.data[x][y] = newVal;
            }
        }
        return this;
    };

    ScaledBitmap.prototype.getPointData = function(pt) {
        var pt2 = Point.mapPointToSpace(pt, this.w,this.h, this.scaledw, this.scaledh);
        return this.data[pt2.x][pt2.y];
    };

    ScaledBitmap.prototype.setPointData = function(pt, val) {
        var pt2 = Point.mapPointToSpace(pt, this.w,this.h, this.scaledw, this.scaledh);
        var col = this.data[pt2.x];
        col[pt2.y] = val;
    };
    ScaledBitmap.createEmpty = function(scaledw, scaledh, w, h, emptyValFn) {
        emptyValFn = emptyValFn || function() { return 0.0 };
        var data = [];
        var x;
        var y;
        for (x=0;x<scaledw;++x) {
            var col = [];
            for (y=0;y<scaledh;++y) {
                col.push(emptyValFn(x,y));
            }
            data.push(col);
        }
        return new ScaledBitmap(data,scaledw,scaledh,w,h);
    };

    return ScaledBitmap;
});