// @TODO should we handle .sg-b-p-c (survey close) as well?

( function( $, mw ) {
	'use strict';

	mw.wr = mw.wr || {};	// Might not be defined yet
	mw.wr.sg = {
		settings: mw.config.get( 'wgSurveyGizmo' ),
		_this: this,
		cookieName: 'Surveys',
		visitorCookie: '_sg_b_v',
		status: {},
		surveyID: null,

		isLandingPage: function() {
			return document.referrer.indexOf( location.protocol + "//" + location.host ) !== 0;
		},

		addSurveyGizmoCode: function() {
			window.SurveyGizmoBeacon = 'sg_beacon';
			window.sg_beacon = window.sg_beacon || function () {
				(window.sg_beacon.q = window.sg_beacon.q || []).push(arguments);
			};
			mw.loader.load( mw.wr.sg.settings.beaconUrl );
			sg_beacon( 'init', mw.wr.sg.settings.beaconID);
			sg_beacon( 'data', 'isLandingPage', mw.wr.sg.isLandingPage() ? "true" : "false" );
			sg_beacon( 'data', 'wgCategories', mw.config.get('wgCategories').join( ',' ) );
			sg_beacon( 'data', 'rejectedSurveys', mw.wr.sg.status.rejected.join( ',' ) );
			sg_beacon( 'data', 'startedSurveys', mw.wr.sg.status.started.join( ',' ) );
			sg_beacon( 'data', 'finishedSurveys', mw.wr.sg.status.finished.join( ',' ) );
			sg_beacon( 'data', 'userType', mw.wr.sg.status.userType );

		},

		getAllPreviousSurveys: function() {
			return (
				mw.wr.sg.status.rejected +
				mw.wr.sg.status.started +
				mw.wr.sg.status.finished
			);
		},


		getSurveyID: function() {
			if( mw.wr.sg.surveyID ) {
				return mw.wr.sg.surveyID;
			}
			var $realLink = $('.sg-b-l-m');
			var matches = $realLink.length > 0 ?
				$realLink.attr('href').match(/\/s3\/(\d+)\//) :
				null
			;

			if ( matches && $.isArray( matches ) && matches[1] ) {
				mw.wr.sg.surveyID = parseInt( matches[1] );
				return mw.wr.sg.surveyID;
			}

			return null;
		},

		addMessageListener: function() {
			window.addEventListener( "message", function( event ) {
				if ( !mw.wr.sg.isValidOrigin( event.origin ) ) {
					return; // La la la, I'm not listening to you!
				}

				var data = JSON.parse( event.data );

				if ( data.action === 'status' ) {
					if( data.status === 'submitted' && data.id ) {
						mw.wr.sg.status.finished.push( data.id );
						mw.wr.sg.trackAnalyticsEvent( 'survey-completed' );
						mw.wr.sg.updateCookie();
					}
				}

				else if ( data.action === 'userType' ) {
					window._gaq = window._gaq || [];
					window._gaq.push(['_setCustomVar',
						2,					// 2nd slot
						'User Type',		// custom variable name
						data.status,		// custom variable filtered in GA
						1					// custom variable scope - visitor-level
					]);
					mw.log( 'User type: ' + data.status );
					mw.wr.sg.status.userType = data.status;
					mw.wr.sg.updateCookie();
				}

				else if ( data.action === 'closeDialog' ) {
					mw.wr.sg.closeDialog();
					window.closeActiveModal(); // In case the survey was loaded in Extension:ShareBar's modal
				}

			});

		},

		trackAnalyticsEvent: function( surveyAction ) {
			window._gaq = window._gaq || [];
			window._gaq.push([
				'_trackEvent',
				'SurveyGizmo-Survey',
				surveyAction,
				mw.wr.sg.getSurveyID().toString(),
				undefined,
				true
			]);
		},

		isValidOrigin: function( origin ) {
			return null !== origin.match(/https?:\/\/(www\.)?surveygizmo\.(com|co\.uk)/);
		},

		updateCookie: function() {
			mw.loader.using( 'mediawiki.cookie', function() {
				mw.log( mw.wr.sg.status );
				mw.cookie.set( mw.wr.sg.cookieName, JSON.stringify( mw.wr.sg.status ), { expires: 365 } );
			});

		},

		setLaunchHandler: function() {
			$('body').on('click', '.sg-b-l-t', function () {
				if (mw.wr.sg.getSurveyID()) {
					mw.wr.sg.status.started.push(mw.wr.sg.surveyID);
					mw.wr.sg.trackAnalyticsEvent( 'survey-started' );
					mw.wr.sg.updateCookie();
					mw.wr.sg.turnIntoRealModal();
				}
			});
		},

		setInterceptCloseHandler: function() {
			$( 'body' ).on( 'click', '.sg-js-d', function() {
				// On clicking the intercept "close" button
				if( mw.wr.sg.getSurveyID() ) {
					mw.wr.sg.status.rejected.push( mw.wr.sg.surveyID );
					mw.wr.sg.trackAnalyticsEvent( 'survey-rejected' );
					mw.wr.sg.updateCookie();
				} else {
					mw.log.warn( 'No survey ID to log' );
				}
			});
		},

		closeDialog: function() {
			// Mime clicking on the close button...
			$( '.sg-b-p-c').click();
		},

		/**
		 * SurveyGizmo's survey window is closed on clicking the overlay,
		 * which is no good. This is a hack to prevent that.
		 * @TODO get this to actually work...
		 */
		turnIntoRealModal: function() {
			$( '.sg-b-p-m').on( 'click', function( e ) {
				e.stopImmediatePropagation();
			});
		},

		init: function() {
			mw.loader.using( 'mediawiki.cookie', function() {
				var cookieVal = mw.cookie.get( mw.wr.sg.cookieName );
				if (cookieVal) {
					mw.wr.sg.status = JSON.parse( cookieVal );
				} else {
					mw.wr.sg.status = {
						rejected: [],
						started: [],
						finished: [],
						userType: null
					};
				}
			});

			mw.wr.sg.addSurveyGizmoCode();

			this.addMessageListener();
			this.setLaunchHandler();
			this.setInterceptCloseHandler();

		}

	};

	mw.wr.sg.init();

})( jQuery, mediaWiki );
