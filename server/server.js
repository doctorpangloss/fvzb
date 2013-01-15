/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Meteor.startup(function() {
    Meteor.users.remove({});
    Games.remove({});
});