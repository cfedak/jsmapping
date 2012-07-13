/*
From https://github.com/ironwallaby/delaunay
License: Public domain
 */
define([],
function() {
    var Triangle = function(a,b,c) {
        this.setCorners(a,b,c);
    };

    Triangle.prototype.setCorners = function(a,b,c) {
        this.a = a
        this.b = b
        this.c = c

        var A = b.x - a.x,
            B = b.y - a.y,
            C = c.x - a.x,
            D = c.y - a.y,
            E = A * (a.x + b.x) + B * (a.y + b.y),
            F = C * (a.x + c.x) + D * (a.y + c.y),
            G = 2 * (A * (c.y - b.y) - B * (c.x - b.x)),
            minx, miny, dx, dy;

        /* If the points of the triangle are collinear, then just find the
         * extremes and use the midpoint as the center of the circumcircle. */
        if (Math.abs(G) < 0.000001) {
            minx = Math.min(a.x, b.x, c.x)
            miny = Math.min(a.y, b.y, c.y)
            dx   = (Math.max(a.x, b.x, c.x) - minx) * 0.5
            dy   = (Math.max(a.y, b.y, c.y) - miny) * 0.5

            this.x = minx + dx
            this.y = miny + dy
            this.r = dx * dx + dy * dy
        } else {
            this.x = (D*E - B*F) / G
            this.y = (A*F - C*E) / G
            dx = this.x - a.x
            dy = this.y - a.y
            this.r = dx * dx + dy * dy
        }
    };

    return Triangle;
});