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

Meteor.publish("gemsInGame",function(gameId) {
    return Gems.find({gameId:gameId});
});

Meteor.publish("unitsInGame",function(gameId){
    return Units.find({gameId:gameId});
});

Meteor.publish("users",function(){
    return Meteor.users.find({});
});

Meteor.startup(function() {
    Units._ensureIndex({gameId:1,role:1,x:1});
    Gems._ensureIndex({gameId:1,role:1,x:1,y:1});
    Gems._ensureIndex({gameId:1,role:1,y:1});

    Games.remove({});
    Units.remove({});
    Gems.remove({});

    // Unit movements
    Meteor.setInterval(function() {
        _.each(_.pluck(Games.find({closed:false, full:true, "bunny.ready":true, "farmer.ready":true}).fetch(),'_id'),function(gameId){
            Meteor.call("tug",gameId,function(e,r){
                // Perform asynchronous spawn
                if (e)
                    console.log(e);
            });
        });
    },800);
    // Unit spawning
    Meteor.setInterval(function() {
        _.each(_.pluck(Games.find({closed:false, full:true, "bunny.ready":true, "farmer.ready":true}).fetch(),'_id'),function(gameId){
            Meteor.call("spawn",gameId,function(e,r){
                // Perform asynchronous spawn
                if (e)
                    console.log(e);
            });
        });
    },1600);
});