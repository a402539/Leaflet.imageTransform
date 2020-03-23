L.ImageTransform = L.ImageOverlay.extend({
    initialize: function (url, anchors, options) { // (String, LatLngBounds, Object)
        L.ImageOverlay.prototype.initialize.call(this, url, anchors, options);
        this.setAnchors(anchors);
        this._pixels = options.pixels;
    },

    setAnchors: function (anchors) {
        this._anchors = [];
        this._bounds = L.latLngBounds(anchors);
        for (var i = 0, len = anchors.length; i < len; i++) {
            var yx = anchors[i];
            this._anchors.push(L.latLng(yx));
        }

        if (this._map) {
            this._reset();
        }
    },

    _latLngToLayerPoint: function(latlng) {
        return this._map.project(latlng)._subtract(this._map.getPixelOrigin());
    },

    setClip: function(clipLatLngs) {
        this.options.clip = clipLatLngs;
        var pixels = [],
            topLeft = this._latLngToLayerPoint(this._bounds.getNorthWest());
        for (var i = 0, len = clipLatLngs.length; i < len; i++) {
            p = this._latLngToLayerPoint(clipLatLngs[i]);
            pixels.push(L.point(p.x - topLeft.x, p.y - topLeft.y));
        }
        /*
        var coordsArr = [[clipLatLngs]];
        if (!L.Util.isArray(clipLatLngs)) {
			this._clipFormat = 'geoJson';
			this._clipType = clipLatLngs.type;
			coordsArr = clipLatLngs.coordinates;
			if (this._clipType.toLowerCase() === 'polygon') {
				coordsArr = [coordsArr];
			}
        }
        */
		this.setClipPixels(pixels);
    },

    getClip: function() {
		if (this._clipFormat === 'geoJson') {
			var coords = this._coordsPixels(this._pixelClipPoints);
 			if (this._clipType.toLowerCase() === 'polygon') {
				coords = coords[0];
			}
           return {
				type: this._clipType,
				coordinates: coords
			};
		}
		return this.options.clip;
		var arr = this.options.clip,
		// var arr = this.options.clip.coordinates,
			res = [];

		for (var i = 0, len = arr.length; i < len; i++) {
			for (var j = 0, len1 = arr[i].length; j < len1; j++) {
				for (var p = 0, len2 = arr[i][j].length; p < len2; p++) {
					var latlng = arr[i][j][p];
					res.push([latlng[1], latlng[0]]);
				}
			}
		}
		return res;
    },

    setClipPixels: function(pixelClipPoints) {
        this._clipDone = false;
        this._pixelClipPoints = pixelClipPoints;
        this._drawCanvas();
    },

    setUrl: function (url) {
        this._url = url;
        this._imgNode.src = this._url;
    },

    getAnchors: function() {
        return this._anchors;
    },

    _imgLoaded: false,
    _initImage: function () {
        this._image = L.DomUtil.create('div', 'leaflet-image-layer');

        if (this._map.options.zoomAnimation && L.Browser.any3d) {
            L.DomUtil.addClass(this._image, 'leaflet-zoom-animated');
        } else {
            L.DomUtil.addClass(this._image, 'leaflet-zoom-hide');
        }

        this._imgNode = L.DomUtil.create('img', 'gmxImageTransform');
        if (this.options.clip) {
            this._canvas = L.DomUtil.create('canvas', 'leaflet-canvas-transform');
            this._image.appendChild(this._canvas);
            this._canvas.style[L.DomUtil.TRANSFORM_ORIGIN] = '0 0';
            this._clipDone = false;
        } else {
            this._image.appendChild(this._imgNode);
            this._imgNode.style[L.DomUtil.TRANSFORM_ORIGIN] = '0 0';

            // Hide imgNode until image has loaded
            this._imgNode.style.display = 'none';
        }
		var node = this._canvas || this._imgNode;

		L.DomEvent
			.on(node, 'contextmenu', L.DomEvent.stopPropagation)
			.on(node, 'contextmenu', L.DomEvent.preventDefault)
			.on(node, 'contextmenu', function (ev) {
				var _showLocation = {
					originalEvent: ev,
					latlng: this._map.mouseEventToLatLng(ev),
					layerPoint: this._map.mouseEventToLayerPoint(ev),
					containerPoint: this._map.mouseEventToContainerPoint(ev)
				};

				this.fire('contextmenu', _showLocation);
		}, this);

        this._updateOpacity();

        //TODO createImage util method to remove duplication
        this._imgLoaded = false;
        L.extend(this._imgNode, {
            galleryimg: 'no',
            onselectstart: L.Util.falseFn,
            onmousemove: L.Util.falseFn,
            onload: L.bind(this._onImageLoad, this),
            onerror: L.bind(this._onImageError, this),
            src: this._url
        });
    },

    _onImageError: function () {
        this.fire('error');
    },

    _onImageLoad: function () {
		if (this._imgNode.decode) {
			this._imgNode.decode({notifyWhen: 'paintable'})		// {firstFrameOnly: true}
				.then(L.bind(this._imageReady, this))
				.catch(this._onImageError.bind(this));
		} else {
			this._imageReady();
		}
    },

    _imageReady: function () {
        if (this.options.clip) {
            this._canvas.width = this._imgNode.width;
            this._canvas.height = this._imgNode.height;
        } else {
            // Show imgNode once image has loaded
            this._imgNode.style.display = 'inherit';
        }
        this._imgLoaded = true;

        this._reset();
        this.fire('load');
    },

    _reset: function () {
        if (this.options.clip && !this._imgLoaded) { return; }
        var div = this._image,
            imgNode = this.options.clip ? this._canvas : this._imgNode,
            topLeft = this._latLngToLayerPoint(this._bounds.getNorthWest()),
            size = this._latLngToLayerPoint(this._bounds.getSouthEast())._subtract(topLeft),
            anchors = this._anchors,
            w = imgNode.width,
            h = imgNode.height,
            pixels = [],
            i, len, p;

        for (i = 0, len = anchors.length; i < len; i++) {
            p = this._latLngToLayerPoint(anchors[i]);
            pixels.push(L.point(p.x - topLeft.x, p.y - topLeft.y));
        }
		this._anch_pixels = pixels;					

        L.DomUtil.setPosition(div, topLeft);

        div.style.width  = size.x + 'px';
        div.style.height = size.y + 'px';
				if (this._pixels === null) {
					this._pixels = [[0, 0], [w, 0], [w, h], [0, h]];					
				}
        
        /*
            var matrix3d = this._matrix3d = L.ImageTransform.Utils.general2DProjection(
            this._pixels[0][0], this._pixels[0][1], pixels[0].x, pixels[0].y,
            this._pixels[1][0], this._pixels[1][1], pixels[1].x, pixels[1].y,
            this._pixels[2][0], this._pixels[2][1], pixels[2].x, pixels[2].y,
            this._pixels[3][0], this._pixels[3][1], pixels[3].x, pixels[3].y
        );

        //something went wrong (for example, target image size is less then one pixel)
        if (!matrix3d[8]) {
            return;
        }

        //matrix normalization
        for (i = 0; i !== 9; ++i) {
            matrix3d[i] = matrix3d[i] / matrix3d[8];
        }

        this._matrix3dInverse = L.ImageTransform.Utils.adj(matrix3d);

        imgNode.style[L.DomUtil.TRANSFORM] = this._getMatrix3dCSS(this._matrix3d);
        */
        if (this.options.clip) {
            if (this._pixelClipPoints) {
               this._drawCanvas();
            } else {
                this.setClip(this.options.clip);
            }
        }
    },

    _coordsPixels: function(fromCoords, toPixelFlag) {
        var topLeft = this._latLngToLayerPoint(this._bounds.getNorthWest()),
            toCoords = [];

		for (var i = 0, len = fromCoords.length; i < len; i++) {
			var ringHells = [];
			for (var j = 0, len1 = fromCoords[i].length; j < len1; j++) {
				var arr = [],
					ring = fromCoords[i][j];
				for (var p = 0, len2 = ring.length, pixel, tp, mp; p < len2; p++) {
					if (toPixelFlag) {
						tp = this._clipFormat === 'geoJson' ? [ring[p][1], ring[p][0]] : ring[p];
						mp = this._latLngToLayerPoint(tp);
						pixel = L.ImageTransform.Utils.project(this._matrix3dInverse, mp.x - topLeft.x, mp.y - topLeft.y);
						arr.push(L.point(pixel[0], pixel[1]));
					} else {
						pixel = ring[p];
						tp = L.ImageTransform.Utils.project(this._matrix3d, pixel.x, pixel.y);
						mp = this._map.layerPointToLatLng(L.point(tp[0] + topLeft.x, tp[1] + topLeft.y));
						arr.push([mp.lng, mp.lat]);
					}
				}
				ringHells.push(arr);
 			}
			toCoords.push(ringHells);
        }

        return toCoords;
    },

    _getMatrix3dCSS: function(arr)	{		// get CSS atribute matrix3d
        var css = 'matrix3d(';
        css += arr[0].toFixed(9) + ',' + arr[3].toFixed(9) + ', 0,' + arr[6].toFixed(9);
        css += ',' + arr[1].toFixed(9) + ',' + arr[4].toFixed(9) + ', 0,' + arr[7].toFixed(9);
        css += ',0, 0, 1, 0';
        css += ',' + arr[2].toFixed(9) + ',' + arr[5].toFixed(9) + ', 0, ' + arr[8].toFixed(9) + ')';
        return css;
    },

    _clipDone: false,
    _drawCanvas: function () {
        if (!this._clipDone && this._imgNode) {
            var canvas = this._canvas,
				cw = this._anch_pixels[1].x - this._anch_pixels[0].x,
				ch = this._anch_pixels[2].y - this._anch_pixels[1].y;
			canvas.width = cw;
			canvas.height = ch;
            var ctx = canvas.getContext('2d'),
                pic = this._imgNode;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            //ctx.fillStyle = ctx.createPattern(this._imgNode, 'no-repeat');
            ax = 0.2; ay = 0.1; Ax = 0.8; Ay = 0.2;
            sx = 0; sy = 0; w = this._imgNode.width; h = this._imgNode.height;
            //ctx.drawImage(pic, sx, sy, w, h);
            ctx.fillStyle = 'red'; r = 5;
            ctx.arc(sx + ax * w - r, sy + ay * h, r, 0, 360);
            Sx = 0;
            Sy = 0;
            W = cw;
            H = ch;
            // p(x,y) -> P(X,Y)
            // px = sx+cx*w, py = sy+cy*h
            // Px = Sx+cx*W, Py = Sy+cy*H
            // Px = Sx+(px-sx)*W/w, Py = Sy+(py-sy)*H/h
            // (px, py) -> (Sx+(px-sx)*W/w, Sy+(py-sy)*H/h)
            // матрица преобразования
            // ( W/w  0   ) Sx-sx*W/w
            // ( 0    H/h ) Sy-sy*H/h
            //ctx.setTransform(1 / 3, .8, .7, 1 / 2, 20, 40);
            ctx.arc(Sx + Ax * W - r, Sy + Ay * H, r, 0, 360);
            console.log(pic, sx, sy, ax * w, ay * h, Sx, Sy, Ax * W, Ay * H);
            ctx.drawImage(pic, sx, sy, ax * w, ay * h, Sx, Sy, Ax * W, Ay * H);
            ctx.fill();
            /*
            ctx.drawImage(pic, sx + ax * w, sy, (1 - ax) * w, ay * h, Sx + Ax * W, Sy, (1 - Ax) * W, Ay * H);
            ctx.fill();
            ctx.drawImage(pic, sx, sy + ay * h, ax * w, (1 - ay) * h, Sx, Sy + Ay * H, Ax * W, (1 - Ay) * H);
            ctx.fill();
            ctx.drawImage(pic, sx + ax * w, sy + ay * h, (1 - ax) * w, (1 - ay) * h, Sx + Ax * W, Sy + Ay * H, (1 - Ax) * W, (1 - Ay) * H);
            ctx.fill();
            */
            /*
            for (var i = 0, len = this._pixelClipPoints.length; i < len; i++) {
				ctx.beginPath();
				for (var j = 0, len1 = this._pixelClipPoints[i].length; j < len1; j++) {
					var ring = this._pixelClipPoints[i][j];
					for (var p = 0, len2 = ring.length; p < len2; p++) {
						var pix = ring[p];
						ctx[p ? 'lineTo' : 'moveTo'](pix.x, pix.y);
					}
				}
				ctx.closePath();
				ctx.fill();
			}

            ctx.fillStyle = null;
            */
            if (this.options.disableSetClip) {
                this._imgNode = null;
            }
            this._clipDone = true;
            
        }
    }
});

L.imageTransform = function (url, bounds, options) {
	return new L.ImageTransform(url, bounds, options);
};
L.ImageTransform.addInitHook(function () {
    if (L.Mixin.ContextMenu) {
		L.ImageTransform.include(L.Mixin.ContextMenu);
	}
});

L.DomUtil.TRANSFORM_ORIGIN = L.DomUtil.testProp(
        ['transformOrigin', 'WebkitTransformOrigin', 'OTransformOrigin', 'MozTransformOrigin', 'msTransformOrigin']);

//Based on http://math.stackexchange.com/questions/296794/finding-the-transform-matrix-from-4-projected-points-with-javascript
(function() {
    function adj(m) { // Compute the adjugate of m
        return [
            m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
            m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
            m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
        ];
    }

    function multmm(a, b) { // multiply two matrices
        var c = Array(9);
        for (var i = 0; i !== 3; ++i) {
            for (var j = 0; j !== 3; ++j) {
                var cij = 0;
                for (var k = 0; k !== 3; ++k) {
                    cij += a[3 * i + k] * b[3 * k + j];
                }
                c[3 * i + j] = cij;
            }
        }
        return c;
    }

    function multmv(m, v) { // multiply matrix and vector
        return [
            m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
        ];
    }

    function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
        var m = [
            x1, x2, x3,
            y1, y2, y3,
            1,  1,  1
        ];
        var v = multmv(adj(m), [x4, y4, 1]);
        return multmm(m, [
            v[0], 0, 0,
            0, v[1], 0,
            0, 0, v[2]
        ]);
    }

    L.ImageTransform.Utils = {
        general2DProjection: function(
              x1s, y1s, x1d, y1d,
              x2s, y2s, x2d, y2d,
              x3s, y3s, x3d, y3d,
              x4s, y4s, x4d, y4d
        ) {
          var s = basisToPoints(x1s, y1s, x2s, y2s, x3s, y3s, x4s, y4s);
          var d = basisToPoints(x1d, y1d, x2d, y2d, x3d, y3d, x4d, y4d);
          return multmm(d, adj(s));
        },

        project: function(m, x, y) {
            var v = multmv(m, [x, y, 1]);
            return [v[0] / v[2], v[1] / v[2]];
        },
        adj: adj
    };
})();
