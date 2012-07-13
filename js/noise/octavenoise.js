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
/*
Based on: http://freespace.virgin.net/hugo.elias/models/m_perlin.htm
 */
define([],
function() {
    var OctaveNoise = function(noiseGenerator, octaves) {
        this.octaves = octaves || 8;
        this.noiseGenerator = noiseGenerator;
    };
    OctaveNoise.prototype.noise = function(x,y) {
        var result = 0;
        var i;
        var persistence = 0.5;
        var frequency;
        var amplitude;
        var maxAmplitude = 0.0;

        for (i = 0; i < this.octaves;++i) {
            frequency = Math.pow(2, i);
            amplitude = Math.pow(persistence, i);
            result += this.noiseGenerator.noise(x * frequency, y * frequency) * amplitude;
            maxAmplitude += amplitude;
        }

        // scale to between -1 and 1;
        return result / maxAmplitude;
    }
    return OctaveNoise;
});