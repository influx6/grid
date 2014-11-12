var stacks = require('stackq');
var plug = require('../plugd.js');
var expects = stacks.Expects;

stacks.Jazz('plate specification', function (_){

  var composable = plug.Composable.make('example');
  composable.registerPlug('append',function(){});

  var composer = plug.Composer.make('dust');
  composable.register(composer);
  var test = composer.use('test').get('test');

  _('can i create a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Composer.isType(f));
      expects.truthy(plug.Composer.isInstance(f));
      expects.isFunction(f.get);
      expects.isFunction(f.use);
    });
    $.for(composer);
  });

  _('can i create a compose from a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Compose.isType(f));
      expects.truthy(plug.Compose.isInstance(f));
    });
    $.for(test);
  });

  _('can i get a compose from a composer',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(f.id == 'test');
      expects.truthy(plug.Compose.isType(f));
      expects.truthy(plug.Compose.isInstance(f));
      expects.truthy(f.plate);
      expects.truthy(plug.Plate.isInstance(f.plate));
    });
    $.for(composer.get('test'));
  });

  _('can i create a plug from a compose',function($){
    $.sync(function(f,g){
      expects.truthy(f);
      expects.truthy(plug.Plug.isType(f));
      expects.truthy(plug.Plug.isInstance(f));
    });
    $.for(test.use('example.append','append','rack').get('rack'));
  });

});
