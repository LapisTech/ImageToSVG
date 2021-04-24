
Promise.all(
[
	customElements.whenDefined( 'drop-image' ),
	customElements.whenDefined( 'pixel-svg' ),
	customElements.whenDefined( 'check-box' ),
] ).then( () =>
{
	document.body.addEventListener('dragover', ( event ) =>
	{
		event.stopPropagation();
		event.preventDefault();
	} );
	document.body.addEventListener( 'drop', ( event ) =>
	{
		event.stopPropagation();
		event.preventDefault();
	} );

	const download = <HTMLAnchorElement>document.getElementById( 'download' );

	const grouping = <CheckBoxElement>document.getElementById( 'grouping' );
	grouping.addEventListener( 'change', () =>
	{
		image.reset();
	} );

	const image = <DropImageElement>document.querySelector( 'drop-image' );
	let filename = '';
	const onLoad = ( ( svg ) =>
	{
		return ( dataUrl: string ) =>
		{
			const image = document.createElement( 'img' );
			image.onload = () =>
			{
				svg.import( image );
				if ( grouping.checked )
				{
					svg.optimize();
				}
				download.download = `${ filename }_${ new Date().getTime() }.svg`;
				download.href = URL.createObjectURL( new Blob( [ svg.export() ], { type: 'text/plainimage/svg+xml' } ) );
			};
			image.src = dataUrl;
		};
	} )( <PixelSVGElement>document.querySelector( 'pixel-svg' ) );

	image.addEventListener( 'dropimage', ( event ) =>
	{
		filename = ( ( e ) => { e.pop(); return e.join( '.' ); } )( ( event.detail.name || '' ).split( '.' ) );
		onLoad( event.detail.dataUrl );
	} );

} );
