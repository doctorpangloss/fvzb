/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var createNewAnonymousUser = function(nickname,callback) {
    nickname = nickname || Math.random().toString(36).slice(-8);
    callback = callback || function(e,r) {console.log(e);};
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    Accounts.createUser({username:"Anonymous " + userIdPadding, password:password, profile:{name:nickname}},callback);
};

var login = function() {
    var loginUsernameOrEmail = $('#loginUsernameOrEmail').attr('value');
    var password = $('#loginPassword').attr('value');

    Meteor.loginWithPassword(loginUsernameOrEmail,password,setErrorAndGoHome);
}

var loginAnonymously = function() {
    var nickname = $('#anonymousNickname').attr('value');
    createNewAnonymousUser(nickname,setErrorAndGoHome);
}

var loginWithFacebook = function() {
    Meteor.loginWithFacebook({},setErrorAndGoHome)
}

var loginWithGoogle = function() {
    Meteor.loginWithGoogle({},setErrorAndGoHome)
}

var signUp = function() {
    if (Meteor.user()) {
        Session.set(SESSION_CURRENT_ERROR,"You are already logged in!");
        return;
    }

    var username = $('#signUpUsername').attr('value');
    var email = $('#signUpEmail').attr('value');
    var password = $('#signUpPassword').attr('value');

    createNewUserAndLogin(username,email,password,function(err){
        if (err) {
            Session.set(SESSION_CURRENT_ERROR,err.reason);
            console.log(err);
        } else {
            $.mobile.changePage('#home');
        }
    });
}