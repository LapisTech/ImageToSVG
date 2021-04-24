interface DropImageElement extends HTMLElement
{
	addEventListener( type: 'dropimage', listener: ( event: DropImageEvent ) => any, options?: boolean | AddEventListenerOptions ): void;
	loadFile( file: File ): void;
	reset(): void;
}

interface DropImageEvent extends CustomEvent
{
	detail: DropImageFile;
}

interface DropImageFile
{
	name: string;
	dataUrl: string;
}

( ( init ) =>
{
	if ( document.readyState !== 'loading' ) { return init(); }
	document.addEventListener( 'DOMContentLoaded', () => { init(); } );
} )( () =>
{
	const tagname = 'drop-image';

	customElements.define( tagname, class extends HTMLElement implements DropImageElement
	{
		private preview: HTMLElement;
		private file: HTMLInputElement;

		constructor()
		{
			super();

			const shadow = this.attachShadow( { mode: 'open' } );

			const style = document.createElement( 'style' );
			style.innerHTML =
			[
				':host { display: block; width: 100%; height: 100%; }',
				':host > div { height: 100%; position: relative; padding: 0.5rem; box-sizing: border-box; }',
				':host > div::before { display: block; content: ""; position: absolute; top: 0.5rem; bottom: 0.5rem; left: 0.5rem; right: 0.5rem; box-sizing: border-box; border: 0.1rem dashed gray; }',
				':host > div > div { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; }',
				':host > div > label { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; text-align: center; box-sizing: border-box; padding-top: calc( 50% - 2rem; ); font-size: 0.8rem; }',
				':host > div > label::before { content: "Drop image file here."; display: block; position: absolute; margin: auto; top: 0; bottom: 0; height: 3rem; width: 100%; }',
				':host > div > div.preview { background-repeat: no-repeat; background-size: contain; background-position: center; image-rendering: pixelated; pointer-events: none; }',
			].join('');

			this.file = document.createElement( 'input' );
			this.file.id = 'file';
			this.file.type = 'file';
			this.file.addEventListener( 'change', ( event ) =>
			{
				if ( !this.file.files ) { return; }
				this.loadFile( this.file.files[ 0 ] );
			} );
			const label = document.createElement( 'label' );
			label.setAttribute( 'for', 'file' );

			const contents = document.createElement( 'div' );
			contents.appendChild( this.file );

			this.preview = document.createElement( 'div' );
			this.preview.classList.add( 'preview' );

			const wrap = document.createElement( 'div' );
			wrap.appendChild( contents );
			wrap.appendChild( label );
			wrap.appendChild( this.preview );
			wrap.addEventListener('dragover', ( event ) =>
			{
				event.stopPropagation();
				event.preventDefault();

				if ( !event.dataTransfer ) { return; }

				event.dataTransfer.dropEffect = 'copy';
			} );
			wrap.addEventListener('drop', ( event ) =>
			{
				event.stopPropagation();
				event.preventDefault();

				if ( !event.dataTransfer ) { return; }

				this.loadFile( event.dataTransfer.files[ 0 ] );
			} );

			shadow.appendChild( style );
			shadow.appendChild( wrap );
		}

		public loadFile( file: File )
		{
			if ( !file || !file.type.match( /image/ ) ) { return; }
			const reader = new FileReader();
			reader.onload = () =>
			{
				this.preview.style.backgroundImage = `url(${ reader.result })`;
				this.dispatchEvent( new CustomEvent<DropImageFile>( 'dropimage',
				{
					detail:
					{
						name : file.name,
						dataUrl: <string>reader.result,
					},
				} ) );
			};
			reader.readAsDataURL( file );
		}

		public reset()
		{
			this.file.value = '';
			this.preview.style.backgroundImage = '';
		}
	} );
} );
