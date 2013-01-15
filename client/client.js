/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
CURRENT_GAME = "currentGame";

Meteor.startup(function (){
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
                return "<p>" + JSON.stringify(game.gemBoards[0]) + "</p>";
        }
    });

    document.body.appendChild(frag);
});