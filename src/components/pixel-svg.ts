interface PixelSVGImportOption
{
	mode?: 'auto' | 'full',
}

interface PixelSVGElement extends HTMLElement
{
	width: number;
	height: number;
	fill: string;

	clear(): void;
	draw( x: number, y: number ): void;
	draw( x: number, y: number, width: number, height: number ): void;
	draw( x: number, y: number, width: number, height: number, fill: string ): void;

	pixels(): SVGRectElement[];

	optimize(): void;
	import( img: HTMLCanvasElement | HTMLImageElement, option?: PixelSVGImportOption ): void;
	export(): string;
}

( ( script, init ) =>
{
	if ( document.readyState !== 'loading' ) { return init( script ); }
	document.addEventListener( 'DOMContentLoaded', () => { init( script ); } );
} )( <HTMLScriptElement>document.currentScript, ( script: HTMLScriptElement ) =>
{
	interface DirectedSegment { sx: number; sy: number; ex: number; ey: number; }

	function ParsePath( path: SVGPathElement | string )
	{
		const d = ( typeof path === 'string' ? path : path.getAttributeNS( null, 'd' ) )  || '';

		const rpath: DirectedSegment[][] = []
		if ( !d ) { return rpath; }

		let rx = 0;
		let ry = 0;
		for ( let p of d.replace( /\s*([MLHVZ])\s*/gi, ' $1 ' ).split( /\s*[Zz]\s*/ ) )
		{
			if ( !p ) { continue; }
			const path: DirectedSegment[] = [];
			let cmd = '';
			const vals: number[] = [];
			for ( let v of p.replace( /([^0-9\.\,\s])/g, ' $1 ' ).replace( /\,/g, ' ' ).split( /\s+/ ) )
			{
				if ( !v ) { continue; }
				switch( v )
				{
					case 'M': case 'm':
					case 'L': case 'l':
					case 'H': case 'h':
					case 'V': case 'v':
						cmd = v;
						continue;
				}
				if ( v.match( /[^0-9\.\,]/ ) ) { continue; }
				vals.push( PositiveNumber( v ) );
				switch( cmd )
				{
					case 'M':
						if ( vals.length < 2 ) { continue; }
						rx = <number>vals.shift();
						ry = <number>vals.shift();
						break;
					case 'm':
						if ( vals.length < 2 ) { continue; }
						rx += <number>vals.shift();
						ry += <number>vals.shift();
						break;
					case 'L':
						if ( vals.length < 2 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: vals[ 0 ], ey: vals[ 1 ] } );
						rx = <number>vals.shift();
						ry = <number>vals.shift();
						break;
					case 'l':
						if ( vals.length < 2 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: rx + vals[ 0 ], ey: ry + vals[ 1 ] } );
						rx += <number>vals.shift();
						ry += <number>vals.shift();
						break;
					case 'H':
						if ( vals.length < 1 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: vals[ 0 ], ey: ry } );
						rx = <number>vals.shift();
						break;
					case 'h':
						if ( vals.length < 1 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: vals[ 0 ], ey: ry } );
						rx += <number>vals.shift();
						break;
					case 'V':
						if ( vals.length < 1 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: rx, ey: vals[ 0 ] } );
						ry = <number>vals.shift();
						break;
					case 'v':
						if ( vals.length < 1 ) { continue; }
						path.push( { sx: rx, sy: ry, ex: rx, ey: ry + vals[ 0 ] } );
						ry += <number>vals.shift();
						break;
				}
			}
			if ( path[ 0 ].sx !== path[ path.length - 1 ].ex || path[ 0 ].sy !== path[ path.length - 1 ].ey )
			{
				path.push( { sx: path[ path.length - 1 ].ex, sy: path[ path.length - 1 ].ey, ex: path[ 0 ].sx, ey: path[ 0 ].sy } );
			}
			rpath.push( path );
		}
		return rpath;
	}

	class DotCanvas
	{
		private lines: number[][];
		private width: number;

		constructor()
		{
			this.clear();
		}

		public clear()
		{
			this.lines = [];
			this.width = 0;
		}

		private fill( x: number, y0: number, y1: number )
		{
			while ( this.lines.length < y1 ) { this.lines.push( [ 0 ] ); }
			if ( this.width <= x ) { this.width = x + 1; }
			for ( let y = y0 ; y < y1 ; ++y )
			{
				// Copy prev value.
				const v = this.lines[ y ][ this.lines[ y ].length - 1 ];
				while ( this.lines[ y ].length < this.width ) { this.lines[ y ].push( v ); }
				// Add fill.
				for ( let i = x ; i < this.width ; ++i )
				{
					++this.lines[ y ][ i ];
				}
			}
		}

		private setPath( path: DirectedSegment )
		{
			if ( path.sx === path.ex )
			{
				if ( path.sy < path.ey )
				{
					//  Down
					this.fill( path.sx, path.sy, path.ey );
				} else
				{
					// Up
					this.fill( path.sx, path.ey, path.sy );
				}
			}
		}

		public parse( path: DirectedSegment[] )
		{
			for ( let v of path ) { this.setPath( v ); }

			const dots: { x: number, y: number }[] = [];
			for ( let y = 0 ; y < this.lines.length ; ++y )
			{
				for ( let x = 0 ; x < this.lines[ y ].length ; ++x )
				{
					if ( this.lines[ y ][ x ] % 2 ) { dots.push( { x: x, y: y } ); }
				}
			}

			return dots;
		}
	}

	class DirectedSegments
	{
		private vecs: DirectedSegment[];

		constructor()
		{
			this.vecs = [];
		}

		public addRect( rect: SVGRectElement )
		{
			if ( !( rect instanceof SVGRectElement ) ) { return; }
			let x = PositiveNumber( rect.getAttributeNS( null, 'x' ) );
			let y = PositiveNumber( rect.getAttributeNS( null, 'y' ) );
			let w = PositiveNumber( rect.getAttributeNS( null, 'width' ) );
			let h = PositiveNumber( rect.getAttributeNS( null, 'height' ) );
			if ( w === 0 || h === 0 ) { return; }
			if ( w < 0 ) { x += w; w = x - 2 * w; } else { w += x; }
			if ( h < 0 ) { y += h; h = y - 2 * h; } else { h += y; }
			for ( ; y < h ; ++y )
			{
				for ( ; x < w ; ++x )
				{
					this.addPixel( x, y );
				}
			}
		}

		public addPixel( x: number, y: number )
		{
			this.vecs.push(
				{ sx: x, sy: y, ex: x + 1, ey: y },
				{ sx: x + 1, sy: y, ex: x + 1, ey: y + 1 },
				{ sx: x + 1, sy: y + 1, ex: x, ey: y + 1 },
				{ sx: x, sy: y + 1, ex: x, ey: y }
			);
		}

		public addPath( path: SVGPathElement | string )
		{
			const paths = ParsePath( path );
			const dots = new DotCanvas();
			for ( let path of paths )
			{
				for ( let dot of dots.parse( path ) )
				{
					this.addPixel( dot.x, dot.y );
				}
			}
		}

		public notDuplicate()
		{
			const nvecs: DirectedSegment[] = [];
			function has( v: DirectedSegment )
			{
				for ( let n of nvecs )
				{
					if ( n.sx === v.sx && n.sy === v.sy && n.ex === v.ex && n.ey === v.ey ) { return true; }
					
				}
				return false;
			}
			for ( let v of this.vecs )
			{
				if ( has( v ) ) { continue; }
				nvecs.push( v );
			}
			this.vecs = nvecs;
		}

		public annihilation()
		{
			const nvecs: DirectedSegment[] = [];
			const vecs: (DirectedSegment|null)[] = [ ... this.vecs ];
			const max = vecs.length;
			for ( let a = 0 ; a < max ; ++a )
			{
				const target = vecs[ a ];
				if ( !target ) { continue; }
				for ( let b = a + 1 ; b < max ; ++b )
				{
					const check = vecs[ b ];
					if ( !check ) { continue; }
					if ( target.sx !== check.ex || target.ex !== check.sx || target.sy !== check.ey || target.ey !== check.sy ) { continue; }
					vecs[ a ] = vecs[ b ] = null;
					break;
				}
				if ( vecs[ a ] ) { nvecs.push( <DirectedSegment>vecs[ a ] ); }
			}
			this.vecs = nvecs;
		}

		private isCornerVector( target: DirectedSegment )
		{
			const vecs = this.vecs;
			const connects = vecs.filter( ( v ) => { return v.ex === target.sx && v.ey === target.sy } );

			if ( target.sx === target.ex )
			{
				for ( let v of connects )
				{
					if ( v.sx === v.ex ) { return false; }
				}
			} else
			{
				for ( let v of connects )
				{
					if ( v.sy === v.ey ) { return false; }
				}
			}
			return true;
		}

		public merge()
		{
			const nvecs = [];
			const vecs = this.vecs;
			const max = vecs.length;
			for ( let a = 0 ; a < max ; ++a )
			{
				const target = vecs[ a ];
				if ( !target || !this.isCornerVector( target ) ) { continue; }
				nvecs.push( vecs[ a ] );
			}

			for ( let target of nvecs )
			{
				for ( let a = 0 ; a < max ; ++a )
				{
					const vec = vecs[ a ];
					if ( vec.sx !== target.ex || vec.sy !== target.ey ) { continue; }
					if ( target.sx === target.ex && vec.sx === vec.ex )
					{
						target.ey = vec.ey;
						a = -1;
					} else if ( target.sy === target.ey && vec.sy === vec.ey )
					{
						target.ex = vec.ex;
						a = -1;
					}
				}
			}
			this.vecs = nvecs;
		}

		public optimize()
		{
			this.notDuplicate();
			this.annihilation();
			this.merge();
		}

		public get() { return this.vecs; }
	}

	class PixelPath
	{
		private paths: DirectedSegment[][];

		constructor()
		{
			this.paths = [];
		}

		public addPath( path: SVGPathElement | string )
		{
			this.paths.push( ... ParsePath( path ) );
		}

		public addPixelVectors( ds: DirectedSegments )
		{
			const paths: DirectedSegment[][] = [];
			const vecs = ds.get();

			while( vecs.length )
			{
				const start = <DirectedSegment>vecs.shift();
				const path = [ start ];
				let now = start;
				while ( now.ex !== start.sx || now.ey !== start.ey )
				{
					for ( let i = 0 ; i < vecs.length ; ++i )
					{
						const vec = vecs[ i ];
						if ( now.ex !== vec.sx || now.ey !== vec.sy ) { continue; }
						path.push( vec );
						now = vec;
						vecs.splice( i, 1 );
						break;
					}
					if ( vecs.length <= 0 ) { break; }
				}
				paths.push( path );
			}

			this.paths = paths;
		}

		private mergePath( a: DirectedSegment[], b: DirectedSegment[] )
		{
			for ( let i = 0 ; i < a.length ; ++i )
			{
				const target = a[ i ];
				for ( let v of b )
				{
					if ( target.ex !== v.sx || target.ey !== v.sy ) { continue; }
					while ( b[ 0 ] !== v ) { b.push( <DirectedSegment>b.shift() ); }
					a.splice( i + 1, 0, ... b );
					return true;
				}
			}
			return false;
		}

		public optimize()
		{
			const paths = this.paths;
			if ( paths.length <= 0 ) { return; }
			const npaths = [ <DirectedSegment[]>paths.shift() ];

			while( 0 < paths.length )
			{
				for ( let p of npaths )
				{
					let merged = false;
					for ( let i = 0 ; i < paths.length ; ++i )
					{
						if ( !this.mergePath( p, paths[ i ] ) ) { continue; }
						paths.splice( i, 1 );
						merged = true;
						break;
					}
					if ( paths.length <= 0 ) { break; }
					if ( !merged ) { npaths.push( <DirectedSegment[]>paths.shift() ); }
				}
			}

			for ( let path of npaths )
			{
				for ( let i = path.length - 1 ; 0 < i ; --i )
				{
					const a = path[ i - 1 ];
					const b = path[ i ];
					if ( a.sx === a.ex && b.sx === b.ex && a.sx === b.sx )
					{
						a.ey = b.ey;
					} else if ( a.sy === a.ey && b.sy === b.ey && a.sy === b.sy )
					{
						a.ex = b.ex;
					} else { continue; }
					path.splice( i, 1 );
				}
			}

			this.paths = npaths;
		}

		private pathToString( path: DirectedSegment[] )
		{
			if ( path[ 0 ].sx === path[ path.length - 1 ].ex && path[ 0 ].sy === path[ path.length - 1 ].ey )
			{
				path = path.slice( 0, path.length - 1 );
			}
			return 'M' + path[ 0 ].sx + ',' + path[ 0 ].sy + path.map( ( vec ) =>
			{
				if ( vec.sx === vec.ex ) { return 'V' + vec.ey; }
				if ( vec.sy === vec.ey ) { return 'H' + vec.ex; }
				return 'L' + vec.ex + ',' + vec.ey;
			} ).join( '' ) + 'Z';
		}

		public toString()
		{
			return this.paths.map( ( path ) => { return this.pathToString( path ); } ).join( ' ' );
		}
	}

	function PositiveNumber( num?: number | string | null )
	{
		if ( !num ) { return 0; }
		num = ( typeof num === 'string' ) ? parseInt( num ) : Math.floor( num );
		if ( num < 0 ) { return 0; }
		return num;
	}

	function ExtractPixels( layer: SVGGElement | SVGElement )
	{
		return [ ... layer.children ].map( ( rect ) =>
		{
			return <SVGRectElement>rect.cloneNode( false );
		} );
	}

	function ImageToCanvas( img: HTMLImageElement )
	{
		const canvas = document.createElement( 'canvas' );
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const context = canvas.getContext( '2d' );
		if ( context )
		{
			context.clearRect( 0, 0, img.width, img.height );
			context.drawImage( img, 0, 0 );
		}
		return canvas;
	}

	function OptimizeLayer( layer: SVGGElement | SVGElement )
	{
		const px: { [ keys: string ]: { d: DirectedSegments, p: PixelPath } } = {};
		function search( fill: string )
		{
			if ( px[ fill ] ) { return px[ fill ]; }

			px[ fill ] =
			{
				d: new DirectedSegments(),
				p: new PixelPath(),
			};

			return px[ fill ];
		}

		const children = [ ... layer.children ];
		for ( let child of children )
		{
			layer.removeChild( child );
			const fill = child.getAttributeNS( null, 'fill' );
			if ( !fill ) { continue; }
			const p = search( fill );
			if ( child instanceof SVGRectElement )
			{
				p.d.addRect( child );
			} else if ( child instanceof SVGPathElement )
			{
				p.p.addPath( child );
			}
		}

		for ( let fill of Object.keys( px ) )
		{
			const p = px[ fill ];
			p.d.optimize();
			p.p.addPixelVectors( p.d );
			p.p.optimize();
			const path = document.createElementNS( 'http://www.w3.org/2000/svg', 'path' );
			path.setAttributeNS( null, 'fill', fill );
			path.setAttributeNS( null, 'd', p.p.toString() );
			layer.appendChild( path );
		}
	}

	( ( component, tagname = 'pixel-svg' ) =>
	{
		if ( customElements.get( tagname ) ) { return; }
		customElements.define( tagname, component );
	} )( class extends HTMLElement implements PixelSVGElement
	{
		private svg: SVGElement;

		constructor()
		{
			super();

			const style = document.createElement( 'style' );
			style.innerHTML =
			[
				':host { display: block; }',
				':host > div { display: grid; justify-content: stretch; align-items: center; width: 100%; height: 100%; }',
				'svg { display: block; width: 100%; height: auto; object-fit: contain; }',
				'svg:not( .edit ) { width: 100%; height: 100%; }',
			].join( '' );

			this.svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
			//this.svg.setAttributeNS( null, 'preserveAspectRatio', 'none' );
			this.svg.setAttributeNS( 'http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg' );
			this.svg.setAttributeNS( null, 'version', '1.1' );

			const contents = document.createElement( 'div' );
			contents.appendChild( this.svg );

			const shadow = this.attachShadow( { mode: 'open' } );
			shadow.appendChild( style );
			shadow.appendChild( contents );

			if ( !this.width ) { this.width = 1; }
			if ( !this.height ) { this.height = 1; }
			if ( !this.fill ) { this.fill = 'black'; }

			this.update();
		}

		private update()
		{
			const width = this.width;
			const height = this.height;
			// Calc render size.
			this.svg.classList.add( 'edit' );
			this.svg.setAttributeNS( null, 'width', width + 'px' );
			this.svg.setAttributeNS( null, 'height', height + 'px' );
			this.svg.setAttributeNS( null, 'viewBox', '0 0 ' + width + ' ' + height );
			// Reset size.
			setTimeout( () => { this.svg.classList.add( 'edit' ); }, 0 );
		}

		public clear()
		{
			this.svg.innerHTML = '';
		}

		public draw( x: number, y: number, width?: number, height?: number, fill?: string )
		{
			const rect = document.createElementNS( 'http://www.w3.org/2000/svg', 'rect' );
			rect.setAttribute( 'x', PositiveNumber( x ) + '' );
			rect.setAttribute( 'y', PositiveNumber( y ) + '' );
			rect.setAttribute( 'width', ( PositiveNumber( width ) || 1 ) + '' );
			rect.setAttribute( 'height', ( PositiveNumber( height ) || 1 ) + '' );
			rect.setAttribute( 'fill', fill || this.fill );
			this.svg.appendChild( rect );
		}

		public pixels()
		{
			const pixels: SVGRectElement[] = [];
			pixels.push( ... ExtractPixels( this.svg ) );
			return pixels;
		}

		public optimize()
		{
			OptimizeLayer( this.svg );
		}

		public import( img: HTMLCanvasElement | HTMLImageElement, option?: PixelSVGImportOption )
		{
			const canvas = img instanceof HTMLCanvasElement ?
				img :
				( () =>
				{
					if ( !( img instanceof HTMLImageElement ) ) { return null; }
					return ImageToCanvas( img );
				} )();
			if ( !canvas ) { return; }

			const context = canvas.getContext( '2d' );
			if ( !context ) { return; }

			this.clear();

			const transparent = option && option.mode === 'full';
			const pixels = context.getImageData( 0, 0, canvas.width, canvas.height ).data;
			this.width = canvas.width;
			this.height = canvas.height;

			for ( let y = 0 ; y < canvas.height ; ++y )
			{
				const base = y * canvas.width;
				for ( let x = 0 ; x < canvas.width ; ++x )
				{
					const i = ( base + x ) * 4;
					if ( !transparent && pixels[ i + 3 ] <= 0 ) { continue; }
					this.draw( x, y, 1, 1, '#' +
						pixels[ i ].toString( 16 ).padStart( 2, '0' ) +
						pixels[ i + 1 ].toString( 16 ).padStart( 2, '0' ) +
						pixels[ i + 2 ].toString( 16 ).padStart( 2, '0' ) +
						pixels[ i + 3 ].toString( 16 ).padStart( 2, '0' ) );
				}
			}
		}

		public export() { return this.svg.outerHTML; }

		get width() { return PositiveNumber( this.getAttribute( 'width' ) ); }

		set width( value ) { this.setAttribute( 'width', PositiveNumber( value ) + '' ); this.update(); }

		get height() { return PositiveNumber( this.getAttribute( 'height' ) ); }

		set height( value ) { this.setAttribute( 'height', PositiveNumber( value ) + '' ); this.update(); }

		get fill() { return this.getAttribute( 'fill' ) || ''; }

		set fill( value ) { this.setAttribute( 'fill', value || '' ); }

		static get observedAttributes() { return [ 'width', 'height' ]; }

		public attributeChangedCallback( attrName: string, oldVal: any , newVal: any )
		{
			if ( oldVal === newVal ) { return; }
			switch ( attrName )
			{
				case 'width': this.width = newVal; break;
				case 'height': this.height = newVal; break;
			}
		}

	}, script.dataset.tagname );
} );
