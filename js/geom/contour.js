/*
    License unknown.
    (C) Raymond Hill
    Believed to be free for non-commercial use
 */
define(["geom/point"],
function(Point) {
    var Contour =function(points) {
        this.pts = points || [];
    };

    Contour.prototype.area = function() {
        var area=0;
        var pts = this.pts;
        var nPts = pts.length;
        var j=nPts-1;
        var p1; var p2;

        for (var i=0;i<nPts;j=i++) {
            p1=pts[i]; p2=pts[j];
            area+=p1.x*p2.y;
            area-=p1.y*p2.x;
        }
        area/=2;

        return area;
    };

    Contour.prototype.centroid = function() {
        var pts = this. pts;
        var nPts = pts.length;
        var x=0; var y=0;
        var f;
        var j=nPts-1;
        var p1; var p2;

        for (var i=0;i<nPts;j=i++) {
            p1=pts[i]; p2=pts[j];
            f=p1.x*p2.y-p2.x*p1.y;
            x+=(p1.x+p2.x)*f;
            y+=(p1.y+p2.y)*f;
        }

        f=this.area()*6;

        return new Point(x/f, y/f);
    };

    return Contour;
});