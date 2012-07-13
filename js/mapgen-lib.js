/**
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

 Based heavily on http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/ and
                  https://github.com/amitp/mapgen2
                  (C) Amit Patel
 */
define(["random",
    "libs/rhill-voronoi-core",
    "geom/rectangle",
    "geom/point",
    "geom/contour",
    "noise/simplexnoise",
    "noise/octavenoise",
    "scaledbitmap"],
function(random,
         Voronoi,
         Rectangle,
         Point,
         Contour,
         SimplexNoise,
         OctaveNoise,
         ScaledBitmap) {
    var NUM_LLOYD_ITERATIONS = 2;
    var siteToString = function(site) {
        return site.x + "," + site.y;
    };
    var pointsInCell = function(cell) {
        var points = [];
        var i;
        if (cell.halfedges.length > 0) {
            points.push(cell.halfedges[0].getStartpoint());
        }
        for (i = 0; i < cell.halfedges.length; ++i) {
            var he = cell.halfedges[i];
            points.push(he.getEndpoint());
        }
        return points;
    };

    return {
        generateRandomPoints: function(num_points, bounds) {
            var p,
                i,
                points = [];

            for (i = 0; i < num_points; ++i) {
                p = {
                    x:random.floatInRange(bounds.x+10, bounds.right-10),
                    y:random.floatInRange(bounds.y+10, bounds.bottom-10)
                };
                if ( isNaN(p.x) ) {
                    throw new Error("WTF");
                }
                points.push(p);
            }
            return points;
        },
        relaxPoints: function(points, bounds) {
            var i, p, q, voronoi, region;
            var rhbounds = {xl:bounds.x, xr:bounds.right, yt:bounds.y, yb:bounds.bottom};
            var res;
            for (i = 0; i < NUM_LLOYD_ITERATIONS; ++i) {
                var voronoi = new Voronoi();
                res = voronoi.compute(points, rhbounds);
                var cellBySite = {};
                res.cells.forEach(function(cell) {
                    cellBySite[siteToString(cell.site)] = cell;
                });
                points.forEach(function(p) {
                    var cell = cellBySite[siteToString(p)];
                    var cellpoints = pointsInCell(cell);
                    var contour = new Contour(cellpoints);
                    var centroid = contour.centroid();
                    p.x = centroid.x;
                    p.y = centroid.y;
                });
            }
        },
        computeAdjacencyMap:function(edges) {
            var siteById = {};
            var map = {};
            var addSite = function(site) {
                if (!siteById.hasOwnProperty(site.voronoiId)) {
                    siteById[site.voronoiId] = site;
                }
                if (!map.hasOwnProperty(site.voronoiId)) {
                    map[site.voronoiId] = [];
                }
            };
            edges.forEach(function(edge) {
                if (edge.lSite && edge.rSite) {
                    addSite(edge.lSite);
                    addSite(edge.rSite);
                    map[edge.lSite.voronoiId].push(edge.rSite.voronoiId);
                    map[edge.rSite.voronoiId].push(edge.lSite.voronoiId);
                }
            });
            return {siteMap:siteById, adjacencyMap:map};
        },
        generateHeightMap: function(w,h,o,f) {
            o = o || 8;
            f = f || 1;
            f = Math.abs(f);
            var noise = new OctaveNoise(new SimplexNoise(),o);
            var map = [];
            var mapX, mapY;
            for (mapX = 0; mapX < w; ++mapX) {
                var column = [];
                for (mapY = 0; mapY < h; ++mapY) {
                    column.push(noise.noise(mapX/(w/f), mapY/(h/f)));
                }
                map.push(column);
            }
            return map;
        },
        normalizeHeightMap: function(heightmap,w,h, min, max) {
            var bm = new ScaledBitmap(heightmap, w,h);
            var actualMin;
            var actualMax;
            bm.forEach(function(val) {
                actualMin = actualMin || val;
                actualMax = actualMax || val;
                actualMin = Math.min(val, actualMin);
                actualMax = Math.max(val, actualMax);
            });
            var actualRange = (actualMax - actualMin) || 0;
            var range = max - min;
            var denom = actualRange / range;

            // normalizes elevations between -1 and 1 with equal amounts of peaks and valleys;
            bm.mapInPlace(function(val) {
                var zeroBased = val - actualMin;
                var inRange = zeroBased / denom;
                var withMin = inRange + min;
                return withMin;
            });
            return heightmap;
        },
        markBorderCells: function(voronoi) {
            voronoi.borderCells = [];
            voronoi.cellMap = {};
            voronoi.cells.forEach(function(cell) {
                voronoi.cellMap[cell.site.voronoiId] = cell;
                cell.border = false;
                cell.halfedges.forEach(function(he) {
                    if (he.edge.lSite === null || he.edge.rSite === null) {
                        cell.border = true;
                    }
                });
                if (cell.border) {
                    voronoi.borderCells.push(cell);
                }
            });
        },
        createAdjacencyInfo: function(voronoi) {
            voronoi.adjacency = this.computeAdjacencyMap(voronoi.edges);
            return voronoi.adjacency;
        },
        createTemperatureMap: function(voronoi,w,h) {
            var map = this.generateHeightMap(w/4,h/4, 8,1.3);
            var m2p = Point.mapPointToSpace;
            var heightForPoint = function(pt) {
                var p2 = m2p(pt,w,h,w/4,h/4);
                return (map[p2.x][p2.y]+1)/2; // norm to 0..1;
            };
            var mapX, mapY;
            var cY = h/2;
            var tempForPt = function(pt) {
                var dY = Math.abs(pt.y-cY);
                return ((1 - (dY / cY)) * 0.7) + (0.3 * heightForPoint(pt));
            };
            voronoi.cells.forEach(function(cell) {
                cell.temperature = tempForPt(cell.site);
            },this);
            if (voronoi.hasOwnProperty('cornerList')) {
                voronoi.cornerList.forEach(function(corner) {
                    corner.temperature = tempForPt(corner.pt);
                });
            }
        },
        createCorners: function(voronoi, waterLine, heightMapFn) {
            var cornerDict = {};
            var cornerList = [];

            //create corners
            voronoi.edges.forEach(function(edge) {
                var createCorner = function(pt, ptother, e) {
                    var key = Point.toString(pt);
                    var height = heightMapFn(pt);
                    var corner = cornerDict[key] = cornerDict[key] || { edges:{}, neighbors:[], pt:pt, water: height <= waterLine, elevation:height};
                    corner.edges[Point.toString(ptother)] = e;
                    corner.neighbors.push(Point.toString(ptother));
                    if (e.lSite === null || e.rSite === null) {
                        corner.border = true;
                        corner.water = true;
                        corner.elevation = waterLine;
                    }
                };
                createCorner(edge.va, edge.vb, edge);
                createCorner(edge.vb, edge.va, edge);
            });

            // create corner list && fix neighbors
            var keys = Object.keys(cornerDict);
            keys.forEach(function(key) {
                var corner = cornerDict[key];
                corner.neighbors = corner.neighbors.map(function(k) {
                    return cornerDict[k];
                });
                cornerList.push(corner);
            });

            //add corners to cells
            voronoi.cells.forEach(function(cell) {
                var added = {};
                var addCorner = function(pt) {
                    var key = Point.toString(pt);
                    if (!added.hasOwnProperty(key)) {
                        cell.corners.push(cornerDict[key]);
                        added[key] = true;
                    }
                };
                cell.corners = [];
                cell.halfedges.forEach(function(he) {
                    addCorner(he.edge.va);
                });
            });

            voronoi.cornerDict = cornerDict;
            voronoi.cornerList = cornerList;
        },
        markRivers: function(voronoi, num_attempts) {
            // choose 100 random corners
            // use dykstras to find a downslope path to water, if possible
            // well, technically it's astar, but I don't have a heuristic, so it's equiv
            num_attempts = num_attempts || 100;
            var chooseCorner = function() {
                var index = Math.floor(Math.random()*voronoi.cornerList.length);
                return voronoi.cornerList[index];
            };
            var i;
            for (i = 0; i < num_attempts; ++i) {
                var corner = chooseCorner();
                if (corner && !corner.water && corner.elevation > 0.3 && corner.elevation < 0.94) {
                    var closed = [{c:corner, parent:null, g:0, h:corner.elevation}];//naive heuristic
                    var cornerQueue = [];
                    var queueDownslopeNeighbors = function(parent) {
                        var downslope = parent.c.neighbors.filter(function(c) {
                            return c.elevation < parent.c.elevation;
                        }).map(function(c) {
                            return {c:c, parent:parent, g:parent.g+1, h:c.elevation};
                        });
                        downslope.forEach(function(neighbor) {
                            var j = 0;
                            var foundInOpen = false;
                            for (j;j < cornerQueue.length;++j) {
                                var open = cornerQueue[j];
                                if (open.c === neighbor.c) {
                                    foundInOpen = true;
                                    if ((neighbor.g+neighbor.h) < (open.g+open.h)) {
                                        open.g = neighbor.g;
                                        open.h = neighbor.h;
                                        open.parent = neighbor.parent;
                                        break;
                                    }
                                }
                            }
                            if (!foundInOpen) {
                                cornerQueue.push(neighbor);
                            }
                        });
                    };
                    var node = closed[0];
                    queueDownslopeNeighbors(closed[0]);
                    while (!node.c.water && cornerQueue.length > 0) {
                        // sort on cost
                        cornerQueue.sort(function(a,b) {
                            return (a.h + a.g) - (b.h + b.g);
                        });
                        node = cornerQueue.pop();
                        closed.push(corner);
                        if (!node.c.water) {
                            queueDownslopeNeighbors(node);
                        }
                    }
                    if (node.c.water) {
                        //found a river, mark river path by traversing backwards
                        while (node.parent) {
                            var parentKey = Point.toString(node.parent.c.pt);
                            var edge = node.c.edges[parentKey];
                            node.c.river = (node.c.river || 0) + 1;
                            edge.river = (edge.river || 0) + 1;
                            node = node.parent;
                        }
                        //and mark the last corner
                        node.c.river = (corner.river || 0) + 1;
                    }
                }
            }
        },
        markWaterAndCoast: function(voronoi, waterLine, heightMapFn) {
            if (!voronoi.hasOwnProperty("borderCells")) {
                this.markBorderCells(voronoi);
            }
            if (!voronoi.hasOwnProperty("adjacency")) {
                this.createAdjacencyInfo(voronoi);
            }
            var landCells = [];
            voronoi.cells.forEach(function(cell) {
                //mark water
                var waterThreshold = 0.5;
                var waterCount = 0;
                if (cell.border) {
                    cell.water = true;
                } else {
                    cell.halfedges.forEach(function(he) {
                        var height = heightMapFn(he.edge.va);
                        if (height <= waterLine) {
                            ++waterCount;
                        };
                    });

                    var waterProp = waterCount / cell.halfedges.length;

                    cell.water = waterProp > waterThreshold;
                }
                if (!cell.water) {
                    cell.elevation = heightMapFn(cell.site);
                    landCells.push(cell);
                }
            });

            // flood fill the ocean
            var visited = {};
            var toVisit = [];
            var oceanCells = [];
            voronoi.borderCells.forEach(function(borderCell) {
                var visitCell = function(cell) {
                    if (visited.hasOwnProperty(cell.site.voronoiId)) {
                        return;
                    }
                    visited[cell.site.voronoiId] = true;
                    cell.ocean = true;
                    oceanCells.push(cell);
                    var siteIds = voronoi.adjacency.adjacencyMap[cell.site.voronoiId];
                    siteIds.forEach(function(id) {
                        var testCell = voronoi.cellMap[id];
                        if (!visited.hasOwnProperty(id) && testCell.water) {
                            toVisit.push(testCell);
                        }
                    });
                };
                visitCell(borderCell);
                while (toVisit.length > 0) {
                    var nextCell = toVisit.shift();
                    visitCell(nextCell);
                }
            });

            landCells.forEach(function(cell) {
                var oceanCount = 0;
                cell.halfedges.forEach(function(he) {
                    var testCellId = function(id) {
                        var lCell = voronoi.cellMap[id];
                        if (lCell.ocean) {
                            ++oceanCount;
                        }
                    }
                    if (he.edge.lSite !== null && he.edge.lSite.voronoiId !== cell.site.voronoiId) {
                        testCellId(he.edge.lSite.voronoiId);
                    } else if (he.edge.rSite !== null && he.edge.rSite.voronoiId !== cell.site.voronoiId) {
                        testCellId(he.edge.rSite.voronoiId);
                    }
                });
                if (oceanCount >0) {
                    cell.coast = true;
                }
            });

            oceanCells.forEach(function(cell) {
                var landCount = 0;
                cell.halfedges.forEach(function(he) {
                    var testCellId = function(id) {
                        var lCell = voronoi.cellMap[id];
                        if (!lCell.water) {
                            ++landCount;
                        }
                    }
                    if (he.edge.lSite !== null && he.edge.lSite.voronoiId !== cell.site.voronoiId) {
                        testCellId(he.edge.lSite.voronoiId);
                    } else if (he.edge.rSite !== null && he.edge.rSite.voronoiId !== cell.site.voronoiId) {
                        testCellId(he.edge.rSite.voronoiId);
                    }
                });
                if (landCount >0) {
                    cell.shelf = true;
                }
            });

            this.classifyTerrain(voronoi);
        },
        classifyTerrain: function(voronoi) {
            voronoi.cells.forEach(function(cell) {
                if (cell.water && cell.ocean && cell.shelf) {
                    cell.terrain = "shelf";
                } else if (cell.water && cell.ocean) {
                    cell.terrain = "ocean";
                } else if (cell.water) {
                    cell.terrain = "lake"
                } else if (cell.coast) {
                    cell.terrain = "coast";
                } else {
                    if (cell.elevation > 0.94) {
                        cell.terrain = "peak"
                    } else if (cell.elevation > 0.85) {
                        cell.terrain = "mountain";
                    } else if (cell.elevation > 0.55) {
                        cell.terrain = "hill";
                    } else {
                        cell.terrain = "plain";
                    }

                }
            });
        }
    }
});