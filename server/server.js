/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Meteor.publish("games",function(){
    return Games.find({},{fields:{title:1,closed:1,users:1,roles:1,_id:1}});
});

Meteor.publish("currentGame",function(gameId) {
    // TODO Hide secret information like gemboard from opponents.
    return Games.find({_id:gameId});
});

Meteor.publish("unitsInGame",function(gameId){
    return Units.find({gameId:gameId});
});

Meteor.publish("users",function(){
    return Meteor.users.find({});
});

Meteor.startup(function() {
    Games.remove({});
    Units.remove({});
});