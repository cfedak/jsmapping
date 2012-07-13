/*
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
    "map_pixel",
    "geom/rectangle",
    "libs/canvasStack",
    "libs/canvas2image",
    "libs/jquery-1.7.1.min",
    "libs/modernizr-2.5.3.min",
    "plugins"],
    function(mapgen,
             Map,
             Rectangle,
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
                    return grayscaleRGBA(Math.floor(255*(noise+1)/2));
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

                var drawMap = function(map, ctx, valToColorF) {
                    valToColorF = valToColorF || mapNoiseToColor;
                    var x, y;
                    var imgData = ctx.createImageData(map.length, map[0].length);
                    for (x = 0; x < map.length; ++x) {
                        var col = map[x];
                        for (y = 0; y < col.length; ++y) {
                            setPixel(imgData, x, y, valToColorF(col[y]));
                        }
                    }
                    var scaledData = scaledImageData(imgData, canvas.width, canvas.height);
                    ctx.putImageData(scaledData,0,0);
                };

                var drawBiomes = function(map, ctx) {
                    var x, y;
                    var imgData = ctx.createImageData(map.biomeMap.w, map.biomeMap.h);
                    for (x = 0; x < map.biomeMap.w; ++x) {
                        for (y = 0; y <map.biomeMap.h; ++y) {
                            var biome = map.biomeMap.getPointData({x:x, y:y});
                            var rgba = biomeColors[biome].concat([255]);
                            setPixel(imgData, x, y, rgba);
                        }
                    }
                    var scaledData = scaledImageData(imgData, canvas.width, canvas.height);
                    ctx.putImageData(scaledData,0,0);
                };

                var makeGrad = function(start,end,rgb) {
                    return {start:start, end:end, rgb:rgb};
                };
                var selectFromGrad = function(grad, val) {
                    var i;
                    for (i = 0;i<grad.length; ++i) {
                        if (val < grad[i].end) {
                            return grad[i].rgb;
                        }
                    }
                    return [0,0,0];
                };

                drawMap(data.map.scaledElevationMap.data, heightCanvas.getContext("2d"), function(noise) {
                    var tempGrad = [
                        makeGrad(-1.0,-0.8, [0,0,50]),
                        makeGrad(-0.8,-0.6, [0,0,100]),
                        makeGrad(-0.6,-0.4, [0,0,150]),
                        makeGrad(-0.4,-0.2, [0,0,200]),
                        makeGrad(-0.2, 0.0, [0,0,255]),
                        makeGrad( 0.0, 0.2, [33,66,0]),
                        makeGrad( 0.2, 0.4, [99,66,0]),
                        makeGrad( 0.4, 0.6, [255,66,0]),
                        makeGrad( 0.6, 0.8, [255,255,0]),
                        makeGrad( 0.8, 1.0, [255,0,0])
                    ];
                    var rgb = selectFromGrad(tempGrad, noise);
                    rgb.push(255);
                    return rgb;
                });
                drawMap(data.map.scaledTemperatureMap.data, tempCanvas.getContext("2d"), function(noise) {
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
                    var rgb = selectFromGrad(tempGrad, noise);
                    rgb.push(255);
                    return rgb;
                });
                drawMap(data.map.scaledMoistureMap.data, moistureCanvas.getContext("2d"), function(noise) {
                    var tempGrad = [
                        makeGrad(0.0,0.1, [0,0,0]),
                        makeGrad(0.1,0.2, [0,0,25]),
                        makeGrad(0.2,0.3, [0,0,50]),
                        makeGrad(0.3,0.4, [0,0,75]),
                        makeGrad(0.4,0.5, [0,0,100]),
                        makeGrad(0.5,0.6, [0,0,125]),
                        makeGrad(0.6,0.7, [0,0,150]),
                        makeGrad(0.7,0.8, [0,0,175]),
                        makeGrad(0.8,0.9, [0,0,200]),
                        makeGrad(0.9,1.0, [0,0,225]),
                    ];
                    var rgb = selectFromGrad(tempGrad, noise);
                    rgb.push(255);
//                    var val = Math.floor(255*noise);
//                    return [0,0,val,255];
                    return rgb;
                });
                drawBiomes(data.map, biomeCanvas.getContext("2d"));
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
            var bounds = new Rectangle(0, 0, CANVAS_SIZE.width/4, CANVAS_SIZE.height/4);
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

//        var showAdj$ = $('<input type="checkbox">Show Adjacency</input> ');
//        showAdj$.change(function() {
//            updateOpacity();
//            $(adjCanvas).toggle();
//        });
//        options$.append(showAdj$);
//
//        var showTerrain$ = $('<input type="checkbox">Show Terrain</input> ');
//        showTerrain$.attr('checked',true);
//        showTerrain$.change(function() {
//            updateOpacity();
//            $(terrainCanvas).toggle();
//        });
//        options$.append(showTerrain$);

        var showBiome$ = $('<input type="checkbox">Show Biome</input> ');
        showBiome$.attr('checked',true);
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
//        if (showTerrain$.prop("checked") !== true) {
//            $(terrainCanvas).hide();
//        }
//        if (showAdj$.prop("checked") !== true) {
//            $(adjCanvas).hide();
//        }
        if (showHeightMap$.prop("checked") !== true) {
            $(heightCanvas).hide();
        }
        updateOpacity();

        var save$ =  $('<input type="button">Save</input>');
        save$.click(function() {
            Canvas2Image.saveAsJPEG(biomeCanvas);
        });
        main$.append(save$);


        main$.append($('<div id="legend"></div>'));
    });



