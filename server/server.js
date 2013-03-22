/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

Meteor.publish("games",function(){
    return Games.find({});
});

Meteor.publish("currentGame",function(gameId) {
    return Games.find({_id:gameId});
});

Meteor.publish("gemsInGame",function(gameId) {
    var g = Games.findOne({_id:gameId});

    if (!g)
        return;

    if (this.userId && _.contains(g.users,this.userId)) {
        var role = getRole(g,this.userId);
        return Gems.find({gameId:gameId,role:role});
    } else {
        return;
    }
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

    // Unit movements and spawn
    Meteor.setInterval(function() {
        _.each(_.pluck(Games.find({closed:false, full:true, "bunny.ready":true, "farmer.ready":true}).fetch(),'_id'),function(gameId){
            Meteor.call("tug",gameId,function(e,r){
                // Perform asynchronous tug and spawn
                if (e)
                    console.log(e);
            });
        });
    },800);
});