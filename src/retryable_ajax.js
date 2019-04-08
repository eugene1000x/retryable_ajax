
'use strict';


/**
 * Sends AJAX requests with retries.
 * This is useful for handling short server downtimes or one-off failures.
 * 
 * @param ms__retryTimeout Delay time before next retry (in milliseconds).
 */
function RetryableAjax(o__params, ms__retryTimeout)
{
	var $ = jQuery;
	
	var thisRetryableAjax = this;
	var isCancelled = false;
	var jq__ajax = null;
	var originalErrorCallback = null;
	var originalSuccessCallback = null;
	

	if (typeof ms__retryTimeout == 'undefined')
	{
		ms__retryTimeout = 500;
	}
	
	// these options interfere with retry logic, so currently disabled
	var a__disallowedOptions = ['complete', 'dataFilter'];
	for (var option of a__disallowedOptions)
	{
		if (typeof o__params[option] !== 'undefined')
		{
			console.error('Option '+ option +' cannot be passed to RetryableAjax');
			delete o__params[option];
		}
	}
	
	if (typeof o__params.error !== 'undefined')
	{
		originalErrorCallback = o__params.error;
		delete o__params.error;
	}

	if (typeof o__params.success !== 'undefined')
	{
		originalSuccessCallback = o__params.success;
		delete o__params.success;
	}

	execute();
	

	function execute()
	{
		var fn__onFail = function(jq__xhr, s__textStatus, s__errorThrown)
		{
			var a__possibleStatuses = [
				/*null,*/		// documentation mentions "null", but it's not clear in which case
				'timeout',
				'error',
				'abort',
				'parsererror'
			];

			if (a__possibleStatuses.indexOf(s__textStatus) == -1)
			{
				console.error(
					'Unrecognized status: '+ s__textStatus +
							'; possible statuses: '+ a__possibleStatuses +'.'
				);
			}

			if (!isCancelled)
			{
				if (s__textStatus == 'abort')
				{
					console.error(
						'Is not expected to get here with status "abort".'+
								' url: '+ ((typeof o__params.url !== 'undefined') ? o__params.url : '---')
					);
				}
				
				var isRetryable = false;
				if (s__textStatus == 'parsererror')		// permanent error server-side
				{
					isRetryable = false;
				}
				else if (s__textStatus == 'timeout')
				{
					isRetryable = true;
				}
				else if (s__textStatus == 'error')
				{
					var a__retryableHttpStatusCodes = [
						500,		// Internal Server Error
						502,		// Bad Gateway
						503,		// Service Unavailable
						504,		// Gateway Timeout
						507			// Insufficient Storage
					];
						
					// readyState 4 means HTTP request has been completed
					// (either successfully or failed).
					// readyState 0 occurs when there's no network connection
					// or access denied due to CORS, etc.
					// Probably should retry also on network connection errors,
					// if it was possible to distinguish them from other errors with readyState=0.
					isRetryable = jq__xhr.readyState == 4 &&
							a__retryableHttpStatusCodes.indexOf(jq__xhr.status) != -1;
				}
				
				if (isRetryable)
				{
					setTimeout(execute, ms__retryTimeout);
				}
				else
				{
					/*console.log(
						'Error in Ajax request. Status: '+ s__textStatus +
								((typeof o__params.url === 'undefined') ? '' : ('; url: '+ o__params.url))
					);*/
					onNonRetryableFail(jq__xhr, s__textStatus, s__errorThrown);
				}
			}
		};
		
		jq__ajax = $.ajax(o__params).fail(fn__onFail).done(onSuccess);
	}
	
	/**
	 * Cancelling the request stops retrying and prevents "error" and "success"
	 * callbacks from being invoked.
	 * Useful for ensuring that requests do not interfere with each other.
	 * For example, if user has changed selection, old requests should be cancelled,
	 * so that they do not fill form with incorrect data, etc.
	 */
	this.cancel = function()
	{
		isCancelled = true;
		jq__ajax.abort();
	}
	
	function onSuccess(data, s__textStatus, jq__xhr)
	{
		// jQuery seems to invoke success callback even after abort() has been called, we don't want that
		if (originalSuccessCallback !== null && !isCancelled)
		{
			originalSuccessCallback(data, s__textStatus, jq__xhr);
		}
	}
	
	function onNonRetryableFail(jq__xhr, s__textStatus, s__errorThrown)
	{
		// the original fail callback is not called if retrying
		if (originalErrorCallback !== null && !isCancelled)
		{
			originalErrorCallback(jq__xhr, s__textStatus, s__errorThrown);
		}
	}
}
