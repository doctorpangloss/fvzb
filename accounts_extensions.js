/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var userIdToName = function(id) {
    var u = Meteor.users.findOne({_id:id});

    if (!u)
        return "REDACTED.";

    if (u.profile && u.profile.name)
        return u.profile.name;

    if (u.username)
        return u.username;

    if (u.emails && u.emails[0] && u.emails[0].address)
        return u.emails[0].address;
}

var createNewUserAndLogin = function(username,email,password,callback) {
    if (username && email && password) {
        Accounts.createUser({username:username,email:email,password:password},callback);
    } else {
        throw new Meteor.Error(403,"Please fill out: " + (username ? "" : " username") + (email ? "" : " email") + (password ? "" : " password")+".");
    }
}

var createNewAnonymousUser = function(nickname,callback) {
    nickname = nickname || "REDACTED."
    var userIdPadding = Math.random().toString(36).slice(-8);
    var password = Math.random().toString(36).slice(-8);
    Accounts.createUser({username:"Anonymous " + userIdPadding, password:password, profile:{name:nickname}},callback)
}