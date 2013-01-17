/**
 * @author Benjamin Berman
 * © 2012 All Rights Reserved
 **/
var GameStage = {};
var Sprites = new Meteor.Collection();

var initializeCanvas = function() {
    var canvas = document.getElementById('gameCanvas');

    // Set up the stage
    GameStage = new createjs.Stage(canvas);

    // Enable touch events
    createjs.Touch.enable(GameStage);
    GameStage.enableMouseOver(10);
    GameStage.mouseMoveOutside = true;
}

var initializeGemBoard = function(gameId,anchorPoint,width,height) {

}