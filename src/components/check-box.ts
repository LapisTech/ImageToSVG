interface CheckBoxElement extends HTMLElement
{
	addEventListener( type: 'change', listener: ( event: CheckBoxEvent ) => any, options?: boolean | AddEventListenerOptions ): void;
	toggle(): void;
	checked: boolean;
}

interface CheckBoxEvent extends CustomEvent
{
	detail: boolean;
}

( ( init ) =>
{
	if ( document.readyState !== 'loading' ) { return init(); }
	document.addEventListener( 'DOMContentLoaded', () => { init(); } );
} )( () =>
{
	const tagname = 'check-box';

	customElements.define( tagname, class extends HTMLElement implements CheckBoxElement
	{
		constructor()
		{
			super();

			const shadow = this.attachShadow( { mode: 'open' } );

			const style = document.createElement( 'style' );
			style.innerHTML =
			[
				':host { display: block; --size: 1rem; --select: #0075fc; }',
				':host > label { line-height: var( --size ); display: grid; grid-template-columns: var( --size ) 1fr; grid-template-rows: 1fr; }',
				'button { box-sizing: border-box; width: var( --size ); height: var( --size ); padding: 0; border: calc( var( --size ) * 0.1 ) solid gray; border-radius: calc( var( --size ) * 0.2 ); }',
				':host( [ checked ] ) button { background: var( --select ); border: none; color: white; font-weight: bold; }',
				':host( [ checked ] ) button::before { content: "✓"; display: inline; }',
			].join('');

			const button = document.createElement( 'button' );
			button.addEventListener( 'click', () =>
			{
				this.toggle();
			} );

			const contents = document.createElement( 'label' );
			contents.appendChild( button );
			contents.appendChild( document.createElement( 'slot' ) );

			shadow.appendChild( style );
			shadow.appendChild( contents );
		}

		public toggle()
		{
			this.checked = !this.checked;
		}

		get checked() { return this.hasAttribute( 'checked' ); }

		set checked( value: boolean )
		{
			const changed = !value === this.checked;
			if ( !changed ) { return; }
			if ( !value )
			{
				this.removeAttribute( 'checked' );
			} else
			{
				this.setAttribute( 'checked', '' );
			}
			this.dispatchEvent( new CustomEvent( 'change', { detail: !!value } ) );
		}

		static get observedAttributes() { return [ 'checked' ]; }

		attributeChangedCallback( name: string, oldValue: any, newValue: any )
		{
			this.checked = newValue !== null;
		}
	} );
} );
