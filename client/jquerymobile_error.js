/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var setError = function(err,r) {
    if (err) {
        Session.set(SESSION_CURRENT_ERROR,err.reason);
        console.log(err);
    }
}

var setErrorAndGoHome = function (err,r) {
    setError(err,r);
    $.mobile.changePage('#home');
}