/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/

CURRENT_GAME = "currentGame";

/*
* GUI Helpers
* */

var refreshListviews = function() {
    $('.ui-listview[data-role="listview"]').listview("refresh");
    $('[data-role="button"]:visible').button();
}

/*
* Handlebars helpers
* */

Handlebars.registerHelper("times",function(a,b) {
    try {
        return a*b;
    } catch (e) {
        return 1;
    }
});

/*
* Templates
* */

Template.units.units = function() {
    return Units.find({gameId:Session.get(CURRENT_GAME),queued:false,x:{$gte:0,$lt:TUG_BOARD_WIDTH},y:{$gte:0,$lt:TUG_BOARD_HEIGHT}}).fetch();
}

Meteor.startup(function (){
    // Login anonymously
    if (!Meteor.user())
        createNewAnonymousUser();

    // Draw gameboard
    Meteor.call("startGame",function(e,r){
        if (r)
            Session.set(CURRENT_GAME,r);
        if (e)
            console.log(e);
    });

    // Render
    var frag = Meteor.render(function () {
        var g = Session.get(CURRENT_GAME);
        if (g && g.length > 0) {
            var game = Games.findOne({_id:g});
            if (game)
                return "<p>" + getGemBoard(game,Meteor.userId()).join('<br>') + "</p>";
        }
    });

    document.body.appendChild(frag);
});