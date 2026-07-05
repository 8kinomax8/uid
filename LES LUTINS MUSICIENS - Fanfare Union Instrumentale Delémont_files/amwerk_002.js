(function( $ ) {
    'use strict';
	
	 $( document ).ready(function() {
		 
		if ( $('.woocommerce-pagination li:first a').hasClass( "prev" ) ){
			$('.woocommerce-pagination li:first').addClass('woo-first-page');
		}
		if ( $('.woocommerce-pagination li:last a').hasClass( "next" ) ){
			$('.woocommerce-pagination li:last').addClass('woo-last-page');
		}
		
		
		if ( $('.woocommerce-pagination .woo-last-page').length == 0  ){
			$('.woocommerce-pagination .woo-first-page').parent().append( $('.woocommerce-pagination .woo-first-page') );
	    }else{
			$('.woocommerce-pagination .woo-first-page').insertBefore( ".woocommerce-pagination .woo-last-page" );			
		}
	 });	 
	
})( jQuery );


