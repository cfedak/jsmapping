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

 Based heavily on http://www-cs-students.stanford.edu/~amitp/game-programming/polygon-map-generation/ and
 https://github.com/amitp/mapgen2
 (C) Amit Patel
 */
define(
["mapgen-lib",
    "libs/rhill-voronoi-core",
    "geom/point",
    "scaledbitmap"],
function(mapgen,
    Voronoi,
    Point,
    ScaledBitmap) {

    var Map = function() {
        this.elevationOctaves = 4;
        this.elevationFrequency = 2.1;
        this.elevationDownscale = 4;
        this.temperatureOctaves = 8;
        this.temperatureFrequency = 1.3;
        this.temperatureDownscale = 4;
        this.waterLine = 0.0;
    };

    Map.prototype.init = function(bounds, num_points) {
        this.bounds = bounds;
        // basic initialization;
        this.initPolygons(num_points);
        this.initCorners();
        this.initCellMap();
        this.initAdjacency();

        // create noise maps used in creating terrain;
        this.initElevationMap();
        this.initTemperatureMap();


        //mark up the map with interesting features used to determine terrain
        this.markBorderCells();
        this.markElevation();
        this.markTemperature();

        //add water
        this.markWater();
        this.markOcean();
        this.markCoast();
        this.markContinentalShelf();
        this.markRivers(Math.round(num_points/20));

        this.markMoisture();

        this.classifyTerrain();
        this.assignBiomes();

    };

    Map.prototype.initPolygons = function(num_points) {
        num_points = num_points || 1024;
        // voronoi over random points
        var bounds = this.bounds;
        var points = mapgen.generateRandomPoints(num_points, bounds);
        mapgen.relaxPoints(points,bounds);
        var v = new Voronoi();
        var res = v.compute(points, {xl:bounds.x, xr:bounds.right, yt:bounds.y, yb:bounds.bottom});
        this.edges = res.edges;
        this.cells = res.cells;
        this.points = points;
    };

    Map.prototype.initCorners = function() {
        var cornerDict = this.cornerDict = {};
        var cornerList = this.cornerList = [];

        //create corners
        this.edges.forEach(function(edge) {
            var createCorner = function(pt, ptother, e) {
                var key = Point.toString(pt);
                var corner = cornerDict[key] = cornerDict[key] || { edges:{}, neighbors:[], pt:pt };
                corner.edges[Point.toString(ptother)] = e;
                corner.neighbors.push(Point.toString(ptother));
                if (e.lSite === null || e.rSite === null) {
                    corner.border = true;
                }
            };
            createCorner(edge.va, edge.vb, edge);
            createCorner(edge.vb, edge.va, edge);
        });

        // create corner list && turn neighbors into references
        var keys = Object.keys(cornerDict);
        keys.forEach(function(key) {
            var corner = cornerDict[key];
            corner.neighbors = corner.neighbors.map(function(k) {
                return cornerDict[k];
            });
            cornerList.push(corner);
        });

        //add corners to cells
        this.cells.forEach(function(cell) {
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
    };
    Map.prototype.initCellMap = function() {
        this.cellMap = {};
        this.cells.forEach(function(cell) {
            this.cellMap[cell.site.voronoiId] = cell;
        }, this);
    };

    Map.prototype.initAdjacency = function() {
        this.adjacency = mapgen.computeAdjacencyMap(this.edges);
        this.cells.forEach(function(cell) {
            cell.adjCells = [];
            var id = cell.site.voronoiId;
            var neighborCellIds = this.adjacency.adjacencyMap[id];
            neighborCellIds.forEach(function(nbId) {
                cell.adjCells.push(this.cellMap[nbId]);
            }, this);
        }, this);
    };

    Map.prototype.initElevationMap = function() {
        var w = this.bounds.width/this.elevationDownscale;
        var h = this.bounds.height/this.elevationDownscale;
        var map = mapgen.generateHeightMap(w,h, this.elevationOctaves, this.elevationFrequency);
        this.scaledElevationMap = new ScaledBitmap(map, w,h, this.bounds.width, this.bounds.height);

        var min;
        var max;
        this.scaledElevationMap.forEach(function(val) {
            min = min || val;
            max = max || val;
            min = Math.min(val, min);
            max = Math.max(val, max);
        });
        var range = max - min;
        var denom = range/2.0;

        // normalizes elevations between -1 and 1 with equal amounts of peaks and valleys;
        this.scaledElevationMap.mapInPlace(function(val) {
            return (val/denom);
        });

        return this.scaledElevationMap;
    };

    Map.prototype.initTemperatureMap = function() {
        var w = this.bounds.width/this.temperatureDownscale;
        var h = this.bounds.height/this.temperatureDownscale;
        var map = mapgen.generateHeightMap(w,h, this.temperatureOctaves, this.temperatureFrequency);
        this.scaledTemperatureMap = new ScaledBitmap(map, w,h, this.bounds.width, this.bounds.height);
        return this.scaledTemperatureMap;
    };


    Map.prototype.markBorderCells = function() {
        this.borderCells = [];
        this.cells.forEach(function(cell) {
        cell.border = false;
            cell.corners.forEach(function(corner) {
                if (corner.border) {
                    cell.border = true;
                }
            });
            if (cell.border) {
                this.borderCells.push(cell);
            }
        }, this);
    };
    Map.prototype.markElevation = function() {
        this.cornerList.forEach(function(corner) {
            corner.elevation = this.scaledElevationMap.getPointData(corner.pt);
        }, this);
        this.cells.forEach(function(cell) {
            cell.elevation = this.scaledElevationMap.getPointData(cell.site);
        }, this);
    };
    Map.prototype.markTemperature = function() {
        var cY = this.bounds.height/2;
        var tempForPt = function(pt) {
            var dY = Math.abs(pt.y-cY);
            return ((1 - (dY / cY)) * 0.7) + (0.3 * this.scaledTemperatureMap.getPointData(pt));
        };
        this.cornerList.forEach(function(corner) {
            corner.temperature = tempForPt.call(this, corner.pt);
            // for land cells, slightly reduce temperature in high elevations
            if (corner.elevation > this.waterLine) {
                corner.temperature *= (1.0 - (0.3 * corner.elevation));
            }
        }, this);
        this.cells.forEach(function(cell) {
            cell.temperature = tempForPt.call(this, cell.site);
            // for land cells, slightly reduce temperature in high elevations
            if (cell.elevation > this.waterLine) {
                cell.temperature *= (1.0 - (0.3 * cell.elevation));
            }
        }, this);
    };
    Map.prototype.markWater = function() {
        this.cornerList.forEach(function(corner) {
            e = corner.elevation || this.scaledElevationMap.getPointData(corner.pt);
            corner.water = corner.border || e <= this.waterLine;
        }, this);
        this.waterCells = [];
        this.landCells = [];
        this.cells.forEach(function(cell) {
            var waterCount = 0;
            cell.corners.forEach(function(corner) {
                waterCount += corner.water ? 1 : 0;
            }, this);
            cell.water = cell.border || (waterCount/cell.corners.length) > 0.6 ;
            if (cell.water) {
                // mark all corners as water if the parent is judged to be water
                cell.corners.forEach(function(corner) {
                    corner.water = true;
                }, this);
                this.waterCells.push(cell);
            } else {
                this.landCells.push(cell);
            }
        }, this);
    };
    Map.prototype.markOcean = function() {
        // flood fill the ocean
        var visited = {};
        var toVisit = [];
        this.oceanCells = [];

        var visitCell = function(cell) {
            if (visited.hasOwnProperty(cell.site.voronoiId)) {
                return;
            }
            visited[cell.site.voronoiId] = true;
            cell.ocean = true;
            this.oceanCells.push(cell);

            cell.corners.forEach(function(c) {
                c.ocean = true;
            });

            cell.adjCells.forEach(function(testCell) {
                var id = testCell.site.voronoiId;
                if (!visited.hasOwnProperty(id) && testCell.water) {
                    toVisit.push(testCell);
                }
            });
        };

        this.borderCells.forEach(function(borderCell) {
            visitCell.call(this, borderCell);
            while (toVisit.length > 0) {
                var nextCell = toVisit.shift();
                visitCell.call(this,nextCell);
            }
        }, this);
    };
    Map.prototype.markCoast = function() {
        this.landCells.forEach(function(cell) {
            cell.coast = false;
            cell.adjCells.forEach(function(adjCell) {
                if (adjCell.ocean) {
                    cell.coast = true;
                }
            });
        });
    };
    Map.prototype.markContinentalShelf = function() {
        this.oceanCells.forEach(function(cell) {
            var oceanCount = 0;
            cell.shelf = false;
            cell.adjCells.forEach(function(adjCell) {
                if (!adjCell.water) {
                    cell.shelf = true;
                }
            });
        });
    };
    Map.prototype.markRivers = function(num_attempts) {
        // choose 100 random corners
        // use dykstras to find a downslope path to water, if possible
        // well, technically it's astar, but I don't have a heuristic, so it's equiv
        num_attempts = num_attempts || 100;
        var cornerDownslopeNeighbors = function(corner) {
            return corner.neighbors.filter(function(c) {
                return c.elevation < corner.elevation;
            });
        };
        // reduce the number of false starts a bit
        var validCorners = this.cornerList.filter(function(corner) {
            return !corner.water && cornerDownslopeNeighbors(corner).length > 0;
        });
        var chooseCorner = function() {
            var index = Math.floor(Math.random()*validCorners.length);
            return validCorners[index];
        };
        var i;
        for (i = 0; i < num_attempts; ++i) {
            var corner = chooseCorner();
            if (corner && !corner.water && corner.elevation > 0.3 && corner.elevation < 0.94) {
                var closed = [{c:corner, parent:null, g:0, h:corner.elevation}];//naive heuristic
                var cornerQueue = [];
                var queueDownslopeNeighbors = function(parent) {
                    var downslope = cornerDownslopeNeighbors(parent.c).map(function(c) {
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
    };

    Map.prototype.markMoisture = function() {
        var queue = [];
        this.cornerList.forEach(function(corner) {
            if ((corner.water || corner.river > 0) && !corner.ocean) {
                corner.moisture = 1.0;
                queue.push(corner);
            } else {
                corner.moisture = 0.0;
            }
        });

        var corner;
        // spread water to corners until it can't spread any further
        while (queue.length > 0) {
            corner = queue.shift();

            corner.neighbors.forEach(function(neighbor) {
                var newMoisture = neighbor.moisture * 0.9;
                if (newMoisture > neighbor.moisture) {
                    neighbor.moisture = newMoisture;
                    queue.push(r);
                }
            });
        }
        //assign all ocean (and therefore coast) corners a value of 1.0;
        this.cornerList.forEach(function(corner) {
            if (corner.ocean) {
                corner.moisture = 1.0;
            }
        });

        var landCorners = this.cornerList.filter(function(corner) {
            return !corner.ocean;
        });

        landCorners.sort(function(a,b) {
            return a.moisture - b.moisture;
        });

        var i;

        for (i = 0; i < landCorners.length; i++) {
            landCorners[i].moisture = i/(landCorners.length-1);
        }

        this.cells.forEach(function(cell) {
            var sumMoisture = 0.0;
            cell.corners.forEach(function(corner) {
                corner.moisture = Math.min(corner.moisture, 1.0);
                sumMoisture += corner.moisture;
            });
            cell.moisture = sumMoisture / cell.corners.length;
        });

    };

    Map.prototype.assignBiomes = function() {
        var makeTempBand = function(maxTemp, precipBands) {
            return {t:maxTemp, bands:precipBands};
        };
        var makePrecipBand = function(maxPrecip, biome) {
            return {p:maxPrecip, biome:biome};
        };

        var biomes = [];
        biomes.push(makeTempBand(0.1,
            [makePrecipBand(1.0, "ice")]));
        biomes.push(makeTempBand(0.2,
            [makePrecipBand(0.1, "desert"),
             makePrecipBand(1.0, "tundra")]));
        biomes.push(makeTempBand(0.3,
            [makePrecipBand(0.12, "desert"),
             makePrecipBand(0.22, "grassland"),
             makePrecipBand(1.0, "taiga")]));
        biomes.push(makeTempBand(0.75,
            [makePrecipBand(0.15, "desert"),
             makePrecipBand(0.3, "grassland"),
             makePrecipBand(0.6, "forest"),
             makePrecipBand(1.0, "temperate rain forest")]));
        biomes.push(makeTempBand(1.0,
            [makePrecipBand(0.28, "desert"),
                makePrecipBand(0.4, "savanna"),
                makePrecipBand(0.6, "tropical seasonal forest"),
                makePrecipBand(1.0, "tropical rain forest")]));

        this.cells.forEach(function(cell) {
            if (cell.ocean) {
                cell.biome = "ocean";
            } else if (cell.elevation > 0.85) {
                cell.biome = "mountain";
            } else if (cell.water) {
                cell.biome = "lake";
            } else {
                var i;
                var j;
                var precip = null;
                for (i =0;i < biomes.length;++i) {
                    if (cell.temperature <= biomes[i].t) {
                        precip = biomes[i].bands;
                        break;
                    }
                }
                if (precip) {
                    for (j=0;j< precip.length;++j) {
                        if (cell.moisture <= precip[j].p) {
                            cell.biome = precip[j].biome;
                            break;
                        }
                    }
                }
            }

            if (!cell.hasOwnProperty("biome")) {
                cell.biome = "dead";
            }
        });
    };

    Map.prototype.classifyTerrain = function() {
        this.cells.forEach(function(cell) {
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
    };

    return Map;
});