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
requirejs.config({
    baseUrl: 'js',
    shim: {
        'plugins': {
            //These script dependencies should be loaded before loading
            //plugins.js
            deps: ['libs/jquery-1.7.1.min'],
            exports: 'plugins'
        }
    }
});
requirejs(["mapgen-lib",
    "map",
    "geom/Rectangle",
    "libs/rhill-voronoi-core",
    "libs/canvasStack",
    "libs/canvas2image",
    "libs/jquery-1.7.1.min",
    "libs/modernizr-2.5.3.min",
    "plugins"],
function(mapgen,
         Map,
         Rectangle,
         Voronoi,
         CanvasStack,
         Canvas2Image) {
    var CANVAS_SIZE = {width:1280, height:700};

    var main$ = $("div[role='main']");

    var createCanvas = function() {
        var canvas$ = $('<div id="map" style="position:relative"></div>');
        canvas$.attr("width", CANVAS_SIZE.width);
        canvas$.attr("height", CANVAS_SIZE.height);
        canvas$.css("min-height", CANVAS_SIZE.height);
        main$.append(canvas$);
        var stack = new CanvasStack("map");
        return stack;
    };

    var data = {
        originalPoints:[],
        relaxedPoints:[],
        triangles:[],
        adjacency:null
    };

    var terrainColors = {
        shelf: [0,125, 125],
        ocean: [0,0,125],
        lake:  [0,255,255],
        coast: [255,255,0],
        peak:  [255,255,255],
        mountain:  [200,200,200],
        hill:  [99,66,33],
        plain:  [0,255,33]
    };

    var biomeColors = {
        ocean: [0,0,125],
        lake:  [0,33,99],
        mountain:  [200,200,200],
        desert:  [255,255,0],
        plain:  [0,255,33],
        tundra:    [99,255,255],
        ice:    [255,255,255],
        taiga:  [0,0,255],
        grassland: [0,255,0],
        dead:      [0,0,0],
        forest:    [0,99,0],
        savanna:   [99,66,33],
        "temperate rain forest":[255,99,00],
        "tropical rain forest":[255,0,0],
        "tropical seasonal forest":[99,0,0]
    };

    var colorStringWithAlpha = function(arr, alpha) {
        arr = arr || [255,255,255];
        return "rgba(" + arr[0] + "," + arr[1] + "," + arr[2] + "," + alpha + ")";
    };

    var clearCtx = function(ctx) {
        ctx.save();

        // Use the identity matrix while clearing the canvas
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Restore the transform
        ctx.restore();
    };

    var canvasStack = createCanvas();
    var canvas = document.getElementById(canvasStack.getBackgroundCanvasId());
    var heightCanvas = document.getElementById(canvasStack.createLayer());
    var terrainCanvas = document.getElementById(canvasStack.createLayer());
    var biomeCanvas = document.getElementById(canvasStack.createLayer());
    var tempCanvas = document.getElementById(canvasStack.createLayer());
    var moistureCanvas = document.getElementById(canvasStack.createLayer());
    var adjCanvas = document.getElementById(canvasStack.createLayer());

    var redrawCanvas = function() {
        if (canvas.getContext && data.map) {
            var default_ctx = canvas.getContext("2d");
            // Store the current transformation matrix
            clearCtx(default_ctx);

            var drawPoint = function(pt, ctx) {
                ctx = ctx || default_ctx;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 3, 0, 2 * Math.PI, false);
                ctx.fill();
            };

            var drawLine = function(s0, s1, ctx) {
                ctx = ctx || default_ctx;
                ctx.beginPath();
                ctx.moveTo(s0.x, s0.y);
                ctx.lineTo(s1.x, s1.y);
                ctx.stroke();
            };

            var drawAdjacencyMap = function(adj) {
                var ctx = adjCanvas.getContext("2d");
                var keys = Object.keys(adj.adjacencyMap);
                keys.forEach(function(key) {
                    var nbors = adj.adjacencyMap[key];
                    var start = adj.siteMap[key];
                    nbors.forEach(function(nbor) {
                        var end = adj.siteMap[nbor];
                        drawLine(start, end, ctx);
                    });
                });
            };

            var drawVoronoi = function(voronoi, ctx) {
                voronoi.edges.forEach(function(edge) {
                    drawLine(edge.va, edge.vb, ctx);
                });
            };

            var cellToPoly = function(cell) {
                var ptEqual = function(p0, p1) {
                    return p0.x === p1.x && p0.y === p1.y;
                };
                var edges = cell.halfedges.reverse().map(function(he) {
                    return he.edge;
                });
                var poly = [];
                //console.log("begin poly");
                var lastPt;
                if (edges.length >=2) {
                    if (ptEqual(edges[0].va, edges[1].va) ||
                        ptEqual(edges[0].va, edges[1].vb)) {
                        poly.push(edges[0].vb);
                        poly.push(edges[0].va);
                        lastPt = (edges[0].va);
                    } else {
                        poly.push(edges[0].va);
                        poly.push(edges[0].vb);
                        lastPt = (edges[0].vb);
                    }
                    edges.shift();
                }
                edges.forEach(function(edge) {
                    if (ptEqual(lastPt, edge.va)) {
                        //console.log("Edge from (" + lastPt.x + "," + lastPt.y + " to (" + edge.vb.x + "," + edge.vb.x+ ")");
                        poly.push(edge.vb);
                        lastPt = edge.vb;
                    } else {
                        //console.log("Edge from (" + lastPt.x + "," + lastPt.y + " to (" + edge.va.x + "," + edge.va.x+ ")");
                        poly.push(edge.va);
                        lastPt = edge.va;
                    }
                });
                return poly;
            };

            var fillCell = function(cell, ctx) {
                ctx = ctx || default_ctx;
                ctx.save();
                var poly = cellToPoly(cell);
                if (poly.length > 0) {
                    var start = poly[0];
                    ctx.beginPath();
                    ctx.moveTo(start.x, start.y);
                    poly.forEach(function(next) {
                        ctx.lineTo(next.x, next.y);
                    });
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
            };

            var drawTerrain = function(voronoi) {
                var ctx = terrainCanvas.getContext("2d");
                clearCtx(ctx);
                ctx.save();
                ctx.lineWidth = 1;
                var alpha = 1.0;
                voronoi.cells.forEach(function(cell) {
                    ctx.strokeStyle = colorStringWithAlpha(terrainColors[cell.terrain], alpha);
                    ctx.fillStyle = colorStringWithAlpha(terrainColors[cell.terrain], alpha);
                    fillCell(cell, ctx);
                });

                //draw rivers
                voronoi.edges.forEach(function(edge) {
                    ctx.strokeStyle = "cyan";
                    if (edge.river > 0) {
                        ctx.lineWidth = edge.river;
                        ctx.beginPath();
                        ctx.moveTo(edge.va.x, edge.va.y);
                        ctx.lineTo(edge.vb.x, edge.vb.y);
                        ctx.stroke();
                    }
                });
                ctx.restore();
            };

            var drawBiomes = function(voronoi) {
                var ctx = biomeCanvas.getContext("2d");
                clearCtx(ctx);
                ctx.save();
                ctx.lineWidth = 1;
                var alpha = 1.0;
                voronoi.cells.forEach(function(cell) {
                    ctx.strokeStyle = colorStringWithAlpha(biomeColors[cell.biome], alpha);
                    ctx.fillStyle = colorStringWithAlpha(biomeColors[cell.biome], alpha);
                    fillCell(cell, ctx);
                });

                //draw rivers
                voronoi.edges.forEach(function(edge) {
                    ctx.strokeStyle = "cyan";
                    if (edge.river > 0) {
                        ctx.lineWidth = edge.river;
                        ctx.beginPath();
                        ctx.moveTo(edge.va.x, edge.va.y);
                        ctx.lineTo(edge.vb.x, edge.vb.y);
                        ctx.stroke();
                    }
                });
                ctx.restore();
            };

            var drawTriangle = function(triangle, ctx) {
                ctx.moveTo(triangle.a.x, triangle.a.y)
                ctx.lineTo(triangle.b.x, triangle.b.y)
                ctx.lineTo(triangle.c.x, triangle.c.y)
                ctx.closePath();
                ctx.stroke();
            };

            var setPixel = function(imgData, x, y, rgba) {
                var index = (x + y * imgData.width) * 4;
                var i;
                for (i = 0;i < 4;++i) {
                    imgData.data[index+i] = rgba[i];
                }
            };

            var grayscaleRGBA = function(color) {
                return [color,color,color,255];
            };

            var mapNoiseToColor = function(noise) {
                return Math.floor(255/2*(noise+1));
            };

            var scaledImageData = function(imgData, w, h) {
                var originalCanvas = $("<canvas>")
                    .attr("width", imgData.width)
                    .attr("height", imgData.height)[0];
                var scaledCanvas = $("<canvas>")
                    .attr("width", w)
                    .attr("height", h)[0];
                var octx = originalCanvas.getContext("2d");
                octx.putImageData(imgData,0,0);
                var sx = w/imgData.width;
                var sy = h/imgData.height;

                var context = scaledCanvas.getContext("2d");
                //context.scale(sx, sy);
                context.drawImage(originalCanvas,0,0,w,h);
                return context.getImageData(0,0,w,h);
            };

            var drawMap = function(map, ctx) {
                var x, y;
                var imgData = ctx.createImageData(map.length, map[0].length);
                for (x = 0; x < map.length; ++x) {
                    var col = map[x];
                    for (y = 0; y < col.length; ++y) {
                        setPixel(imgData, x, y, grayscaleRGBA(mapNoiseToColor(col[y])));
                    }
                }
                var scaledData = scaledImageData(imgData, canvas.width, canvas.height);
                ctx.putImageData(scaledData,0,0);
            };

            var drawTemp = function(voronoi) {
                var ctx = tempCanvas.getContext("2d");
                clearCtx(ctx);
                var makeGrad = function(start,end,rgb) {
                    return {start:start, end:end, rgb:rgb};
                };
                var tempGrad = [
                    makeGrad(0.0,0.1, [0,0,100]),
                    makeGrad(0.1,0.2, [0,0,150]),
                    makeGrad(0.2,0.3, [0,0,200]),
                    makeGrad(0.3,0.4, [0,0,255]),
                    makeGrad(0.4,0.5, [0,100,0]),
                    makeGrad(0.5,0.6, [0,150,0]),
                    makeGrad(0.6,0.7, [0,200,0]),
                    makeGrad(0.7,0.8, [100,0,0]),
                    makeGrad(0.8,0.9, [150,0,0]),
                    makeGrad(0.9,1.0, [200,0,0]),
                ];
                var colorForTemp = function(temp) {
                    var i;
                    for (i = 0;i<tempGrad.length; ++i) {
                        if (temp < tempGrad[i].end) {
                            return colorStringWithAlpha(tempGrad[i].rgb, 1.0);
                        }
                    }
                };
                ctx.save();
                voronoi.cells.forEach(function(cell) {
                    if (cell.hasOwnProperty("temperature")) {
                        var color = colorForTemp(cell.temperature);
                        ctx.strokeStyle = ctx.fillStyle = color;
                        fillCell(cell, ctx);
                    }
                });
                ctx.restore();
            };

            var drawMoisture = function(voronoi) {
                var ctx = moistureCanvas.getContext("2d");
                var colorForMoisture = function(moisture) {
                    return colorStringWithAlpha([0,0, Math.ceil(255*moisture)], 1.0);
                };
                ctx.save();
                voronoi.cells.forEach(function(cell) {
                    if (cell.hasOwnProperty("moisture")) {
                        var color = colorForMoisture(cell.moisture);
                        ctx.strokeStyle = ctx.fillStyle = color;
                        fillCell(cell, ctx);
                    }
                });
                ctx.restore();
            };

            var drawAdj = function(map) {
                var ctx = adjCanvas.getContext("2d");
                clearCtx(ctx);
                ctx.strokeStyle = "blue";
                ctx.fillStyle = "blue";
                map.points.forEach(function(point) {
                    drawPoint(point, ctx);
                });
                drawAdjacencyMap(data.map.adjacency);
            };

            drawMap(data.map.scaledElevationMap.data, heightCanvas.getContext("2d"));
            drawTerrain(data.map);
            drawBiomes(data.map);
            drawTemp(data.map);
            drawMoisture(data.map);
            drawAdj(data.map);
        }
    };

    var updateLegend = function() {
        var legend = $('<ul id="legend"></ul>');
        var keys = Object.keys(biomeColors);
        keys.forEach(function(key) {
            var color = colorStringWithAlpha(biomeColors[key], 1.0);
            var box = $('<span>&nbsp;&nbsp;&nbsp;</span>');
            box.css('background-color', color);
            var label = $('<span>&nbsp;' + key + '</span>');
            var li = $('<li></li>');
            li.append(box);
            li.append(label);
            legend.append(li);
        });
        $('#legend').replaceWith(legend);
    };

    var generate = function() {
        var bounds = new Rectangle(0, 0, CANVAS_SIZE.width, CANVAS_SIZE.height);
        var num_points = npoints$.val();
        var o = noiseo$.val();
        var f = noisef$.val();

        var map = data.map = new Map();
        map.elevationOctaves = o;
        map.elevationFrequency = f;
        map.waterLine = waterThreshold$.val();
        map.init(bounds,num_points);
        redrawCanvas();
        updateLegend();
    };

    main$.append($('<p></p>'));
    var link$ = $('<a>Generate</a>').css("display", "block").click(generate);
    main$.append(link$);

    var options$ =  $('<div></div>');
    //options$.css('float', 'left');
    main$.append(options$);

    var showHeightMap$ = $('<input type="checkbox">Show Heightmap</input> ');
    showHeightMap$.change(function() {
        updateOpacity();
        $(heightCanvas).toggle();
    });
    options$.append(showHeightMap$);

    var showAdj$ = $('<input type="checkbox">Show Adjacency</input> ');
    showAdj$.change(function() {
        updateOpacity();
        $(adjCanvas).toggle();
    });
    options$.append(showAdj$);

    var showTerrain$ = $('<input type="checkbox">Show Terrain</input> ');
    showTerrain$.attr('checked',true);
    showTerrain$.change(function() {
        updateOpacity();
        $(terrainCanvas).toggle();
    });
    options$.append(showTerrain$);

    var showBiome$ = $('<input type="checkbox">Show Biome</input> ');
    showBiome$.change(function() {
        updateOpacity();
        $(biomeCanvas).toggle();
    });
    options$.append(showBiome$);

    var showTemp$ = $('<input type="checkbox">Show Temp</input> ');
    showTemp$.change(function() {
        updateOpacity();
        $(tempCanvas).toggle();
    });
    options$.append(showTemp$);

    var showMoisture$ = $('<input type="checkbox">Show Moisture</input> ');
    showMoisture$.change(function() {
        updateOpacity();
        $(moistureCanvas).toggle();
    });
    options$.append(showMoisture$);

    var numbers$ =  $('<div></div>');
    main$.append(numbers$);

    var npoints$ = $('<input type="number" name="quantity" min="10" max="100000">Number of points</input>');
    npoints$.val(512);
    numbers$.append(npoints$);
    var waterThreshold$ = $('<input type="number" name="quantity" min="-1.0" max="1.0" step="0.05">Water Threshold</input>');
    waterThreshold$.val(0.05);
    numbers$.append(waterThreshold$);
    var noisef$ = $('<input type="number" name="quantity" min="0.1" max="16.0" step="0.05">Noise Frequency</input>');
    noisef$.val(2.2);
    numbers$.append(noisef$);
    var noiseo$ = $('<input type="number" name="quantity" min="1" max="8" step="1">Octaves</input>');
    noiseo$.val(8);
    numbers$.append(noiseo$);

    var updateOpacity = function() {
        if (options$.find("input:checked").length > 1) {
            $("#map").find("canvas").css("opacity", 0.5);
            $(canvas).css("opactity", 1.0);
        } else {
            $("#map").find("canvas").css("opacity", 1.0);
        }
    };

    if (showMoisture$.prop("checked") !== true) {
        $(moistureCanvas).hide();
    }
    if (showTemp$.prop("checked") !== true) {
        $(tempCanvas).hide();

    }
    if (showBiome$.prop("checked") !== true) {
        $(biomeCanvas).hide();
    }
    if (showTerrain$.prop("checked") !== true) {
        $(terrainCanvas).hide();
    }
    if (showAdj$.prop("checked") !== true) {
        $(adjCanvas).hide();
    }
    if (showHeightMap$.prop("checked") !== true) {
        $(heightCanvas).hide();
    }
    updateOpacity();

    main$.append($('<div id="legend"></div>'));
});



