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
define([],
function() {
    var Point = function(x,y) {
        this.x = x;
        this.y = y;
    };

    Point.distance = function(p0, p1) {
        return Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
    };
    Point.toString = function(pt) {
        return pt.x + "," + pt.y;
    };

    Point.equal = function(p0,p1) {
        return p0.x === p1.x && p0.y === p1.y;
    };

    Point.mapPointToSpace = function(pt, source_w, source_h, target_w, target_h) {
        var x = Math.min(Math.round(pt.x * (target_w/source_w)), target_w-1);
        var y = Math.min(Math.round(pt.y * (target_h/source_h)), target_h-1);
        return {x:x, y:y};
    };

    return Point;
});