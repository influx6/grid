var _ = require('stackq');
var grid = require('../grid.js');

_.Jazz('plug specification', function (r){

  var consoler = grid.Plug.make('consoler',{},function consolerInit(){
    this.in().on(this.$bind(function(p){
      p.stream().on(_.funcs.restrictArgs(console.log,1));
    }));
  });

  var feeder = grid.Plug.make('feed',{},function feedInit(){
    this.in().on(this.$bind(function(p){
      this.out().emit(p);
    }));
  });

  var consoler2 = grid.Plug.make('consoler2',{},function consolerInit(){
    this.in().on(this.$bind(function(p){
      p.stream().on(function(f){
        console.log('2:>',f);
      });
    }));
  });

  feeder.a(consoler).a(consoler2);

  feeder.in().Packets.make({ name:'alex'}).emit('winder');


});
