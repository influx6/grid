var _ = require('stackq');
var grid = require('../grid.js');

_.Jazz('grid.Blueprint specification', function (r){

  var fossil = grid.Blueprint('fossil',function(){
    this.in().on(this.$bind(function(p){
      this.out().emit(p);
    }));
  });


  var ratfossil = fossil.Blueprint('rat:fossil',function(){
    this.in().clearSubscribers();
    this.in().on(this.$bind(function(p){
      r('can i receive a rat fossil packet',function(s){
        s.sync(function(d,g){
          _.Expects.truthy(_.StreamPackets.instanceBelongs(d));
          _.Expects.is(d.body.rak,1);
        });
      }).use(p);
    }));
  });

  var pigratfossil = ratfossil.Blueprint('pig:ratfossil',function(){
    this.in().on(this.$bind(function(p){
      r('can i receive a pig rat fossil packet',function(s){
        s.sync(function(d,g){
          _.Expects.truthy(_.StreamPackets.instanceBelongs(d));
          _.Expects.is(d.body.rak,1);
        });
      }).use(p);
    }));
  });

  var pg = pigratfossil({'name':'box'});
  pg.in().Packets.make({'rak':1}).emit(1);

  r('can i create a rat fossil',function(s){
    s.sync(function(d,g){
      _.Expects.truthy(grid.Print.instanceBelongs(d));
    });
  }).use(ratfossil({'name':'monster'}));

  r('can i create a plug blueprint',function(s){
    s.sync(function(d,g){
      _.Expects.isFunction(d);
      _.Expects.isString(d.id);
      _.Expects.isFunction(d.Imprint);
      _.Expects.isFunction(d.Blueprint);
    });
  }).use(fossil).use(ratfossil);


});
