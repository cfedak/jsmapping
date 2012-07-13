/*
 Ported from: http://nodename.github.com/as3delaunay/
 Copyright (c) 2009 Alan Shaw

 Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
 rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
 Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
 WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS
 OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
 OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

  CJFJuly2012 - ported to javascript, made into a require.js module
 */
define(["geom/winding"],
function(Winding) {
    var Polygon = function(vertices) {
        this.vertices = vertices;
    };

    Polygon.prototype.area = function() {
        return Math.abs(this.signedDoubleArea() * 0.5);
    };

    Polygon.prototype.winding = function() {
        var signedDoubleArea = this.signedDoubleArea();
        if (signedDoubleArea < 0) {
            return Winding.CLOCKWISE;
        }
        if (signedDoubleArea > 0) {
            return Winding.COUNTERCLOCKWISE;
        }
        return Winding.NONE;
    };

    Polygon.prototype.signedDoubleArea = function() {
        var index, nextIndex, p, next;
        var signedDoubleArea = 0;

        for (index = 0; index < this.vertices.length; ++i) {
            nextIndex = (index + 1) % this.vertices.length;
            p = this.vertices[index];
            next = this.vertices[_nextIndex];
            signedDoubleArea += p.x * next.y - next.x * p.y;
        }
        return signedDoubleArea;
    };
    return Polygon;
});