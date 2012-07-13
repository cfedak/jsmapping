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
        this.elevationOctaves = 8;
        this.elevationFrequency = 2.1;
        this.temperatureOctaves = 8;
        this.temperatureFrequency = 1.3;
        this.moistureOctaves = 8;
        this.moistureFrequency = 1.1;
        this.waterLine = 0.0;
    };

    Map.prototype.init = function(bounds) {
        this.bounds = bounds;
        // basic initialization;

        // create noise maps used in creating terrain;
        this.initElevationMap();
        this.initTemperatureMap();
        this.initMoistureMap();

        //mark up the map with interesting features used to determine terrain
        this.assignBiome();
    };

    Map.prototype.initElevationMap = function() {
        var w = this.bounds.width;
        var h = this.bounds.height;
        var map = mapgen.generateHeightMap(w,h, this.elevationOctaves, this.elevationFrequency);
        map = mapgen.normalizeHeightMap(map,w,h,-1,1);
        this.scaledElevationMap = new ScaledBitmap(map, w,h, this.bounds.width, this.bounds.height);

        // reduce elevation at l+r borders to ensure water on edges of map
        var x;
        var y;
        var pt, initialE, subtract, newE;
        for (x=0; x<5;++x) {
            for(y=0;y<h;++y) {
                subtract = 2.0 * Math.pow(0.33, x);
                //left
                pt = {x:x, y:y};
                initialE = this.scaledElevationMap.getPointData(pt);
                newE = Math.max(-1, initialE-subtract);
                this.scaledElevationMap.setPointData(pt, newE);
                //right
                pt = {x:w-x, y:y};
                initialE = this.scaledElevationMap.getPointData(pt);
                newE = Math.max(-1, initialE-subtract);
                this.scaledElevationMap.setPointData(pt, newE);
            }
        }
        return this.scaledElevationMap;
    };

    Map.prototype.initTemperatureMap = function() {
        var w = this.bounds.width;
        var h = this.bounds.height;
        var map = mapgen.generateHeightMap(w,h, this.temperatureOctaves, this.temperatureFrequency);
        map = mapgen.normalizeHeightMap(map,w,h,0,1);
        this.scaledTemperatureMap = new ScaledBitmap(map, w,h, this.bounds.width, this.bounds.height);
        var cY = h/2;

        this.scaledTemperatureMap.mapInPlace(function(val,x,y) {
            var dY = Math.abs(y-cY);
            var elevation = this.scaledElevationMap.getPointData({x:x,y:y});
            var t = (1 - (dY / cY)) * 0.7 + val * 0.3;
            if (elevation > this.waterLine) {
                t *= (1.0 - (0.3 * elevation));
            }
            return t;
        }, this);
        return this.scaledTemperatureMap;
    };

    Map.prototype.initMoistureMap = function() {
        var w = this.bounds.width;
        var h = this.bounds.height;
        var map = mapgen.generateHeightMap(w,h, this.moistureOctaves, this.moistureFrequency);
        map = mapgen.normalizeHeightMap(map,w,h,0,0.4);
        this.scaledMoistureMap = new ScaledBitmap(map, w,h, this.bounds.width, this.bounds.height);
        var emap = this.scaledElevationMap;
        var waterLine = this.waterLine;

        // add water sources for water pixels and mountains
        this.scaledMoistureMap.mapInPlace(function(val,x,y) {
            var e = emap.getPointData({x:x, y:y});
            return e < waterLine || e > 0.66 ? 1.0 : val;
        });

        var neighbors= function(scaledMap, pt, radius, includeself) {
            includeself = includeself || false;
            var res = [];
            var x;
            var y;
            var endX, endY;
            endX = Math.min(scaledMap.scaledw, pt.x+radius);
            endY = Math.min(scaledMap.scaledh, pt.y+radius);
            for (x = Math.max(pt.x-radius, 0); x < endX; ++x) {
                for (y = Math.max(pt.y-radius, 0); y < endY; ++y) {
                    if (!includeself || pt.x !== x || pt.y !== y) {
                        res.push(scaledMap.getPointData({x:x, y:y}));
                    }
                }
            }
            return res;
        };

        var blurWater = function(scaledMap) {
            scaledMap.mapInPlace(function(val, x,y) {
                var nb = neighbors(scaledMap, {x:x, y:y}, 2, true);
                var avg = nb.reduce(function(a,b) {return a+b}) / nb.length;
                return avg;
            });
        };

        // spread water by blurring
        blurWater(this.scaledMoistureMap);
        blurWater(this.scaledMoistureMap);

        return this.scaledMoistureMap;
    };

    Map.prototype.assignBiome = function() {
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

        var empyValFn = function() {
            return "dead";
        };
        var w = this.bounds.width;
        var h = this.bounds.height;
        var x,y;

        this.biomeMap = ScaledBitmap.createEmpty(w,h,w,h, empyValFn);

        var biomeForPoint = function(pt) {
            var e = this.scaledElevationMap.getPointData(pt);
            var t = this.scaledTemperatureMap.getPointData(pt);
            var m = this.scaledMoistureMap.getPointData(pt);

            if (e < this.waterLine) {
                return "ocean";
            } else if (e > 0.66) {
                return "mountain";
            } else {
                var i;
                var j;
                var precip = null;
                for (i =0;i < biomes.length;++i) {
                    if (t <= biomes[i].t) {
                        precip = biomes[i].bands;
                        break;
                    }
                }
                if (precip) {
                    for (j=0;j< precip.length;++j) {
                        if (m <= precip[j].p) {
                            return precip[j].biome;
                        }
                    }
                }
            }
            return "dead";
        };

        for (x=0;x<w;++x) {
            for (y=0;y<h;++y) {
                var pt = {x:x,y:y};
                var biome = biomeForPoint.call(this,pt);
                this.biomeMap.setPointData(pt, biome);
            }
        }
    };

    return Map;
});