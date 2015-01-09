#Plug
 Plug is a [flux](http://facebook.github.io/react/blog/2014/05/06/flux.html) is a simple framework that provides a simpler idea mix on the unidirectional flow of data to create reusable cmponents for task delegation.

[NPM Version][npm-url]

Plug is based on flux, it is an idea on evolving the unidirectional data flow into a more flexible,composable paradigm that suits well to a messaging pattern or a task pattern. Plug brings into flux a concept that both allows the generalization of core functionality into atomic units and allows these units to behave in a manner of tasks providers and reply generators, i.e using message tagging,we can build complex systems that depending on the data within the unidirectional stream, will perfom the specified task and generate a reply data if necessary. Plug evolves towards the graphical programming approach which is its final goals.

##Comparing Plug and Facebook React
 Plug goal is simple and thats the creation of a consistent, api that moves from just the ideas of stores but rather
 asynchronouse and sychronouse job networks,it is an approach to solving the same problem as Flow Based Programming using the flux pattern. But extend that ability to allow natural task streams and natural task reactors that handle those tasks. It allows composition of small atomic unit to create larger ones (i.e compose plugs that do a single task well and combine them into a gigantic network that can perform even more complex task). Plug and Facebook only similarity is on the unidirectional flow of data and the concepts more divergent from that point on.


## Tasks and Replies

### Tasks
  Tasks are what i called the job packet, because the tell the plugs listening that there is work to be done and in need of a plug capapble of doing that job, usually plugs identify tasks they can handle by a 'String' or 'Regular Expression' or 'Function' passed to them at construction stage and if these tasks match, they then handle

## Patterns with Flux

 * There is a unidirectional flow of data
 * There are actions (tasks/replies)
 * String tagging actions (tasks and replies)

 From these point on, Plug brings in the concepts of components that perform the task and return results as replies if needed and provides basic concepts as plugpoints,adaptors and others.


## Differences with Flux

 * There are plugs(components) that consumes these tasks(actions) and return replies if needed.
 * There is the concept of a network (that is a composition of multiple plugs into one).
 * There is the concept of plates which are the connection points for all plugs in a network,its the unidirection stream of data hook into by all plugs.
 * Optional task locking, that ensures only one plug resolves a tasks incase there are plugs of same task type within the network,these is on by default in all plugs
 * There is the concept of selectedChannels or filterChannels, that will filter in only replies or actions,matching
 specific critierias
 * Tasks or Replies can contain asychronous streams of data hence each reply or task is a stream in itself
 * Tasks or Replies should contain meta data
 * There is the concept of plugPoints and platePoints which allow attaching a custom end action to plugs with specific replies,it allows patching into a plugs reply stream to perform custom behaviours that don't necessary need to be a Plug themselves, it allows a programmatic patching into plug operations with breaking the ability to create graphical programming development tools with plug and its concepts of operations


##Installation

  You can install plug using npm and there are future plans to support a bower installation.

### NPM [Plug][npm-url]

  npm install plugd


### Bower

  *bowser support is in-works once plug as been browsified using browsify :)*

## Usage

### Node

  Simple include the node library importation directive as usual in your project:

  ```javascript

    var plug = require('plugd');

  ```

### Browser

  *Once bower support is done,it will be simple as above with*


### Examples

  The starting point in all plug usage is the idea of a atomic solution (i.e the finite operation required to resolve a task) e.g

  * To print out to console

  ```javascript

    //create a simple task and tag it with the id for that task type
    var words = plug.TaskPackets.make('io.out',{ name: 'none your biz' });
    words.emit('slangs').emit('are so cool!');

    var consoler = plug.Plug.make('io.out');
    //listen in on the incoming tasks that match it and perform its work
    consoler.tasks().on(function(task){
      //grab the tasks meta
      var body = task.body;
      console.log('Emtting:',body);
      //output out the data within the tasks stream if any
      var tstream = task.stream();
      tstream.beforeEvent('data',function(f){ console.log('Flushing:',body); });
      tstream.on(function(f){ console.log(f); });
      tstream.afterEvent('endData',function(f){ console.log(body,'ending..'); });
    });


    //send it in ,directly, I wouldnt do it these way seens it defeats the whole "who cares,as far as some one can do it let it get done approach" as these is more direct and sending it knowing it will work
    consoler.tasks().emit(words)

  ```

  * To eat your data

  ```javascript


    var eatUp = function(t){
      //boom the task data :p
      boooooom(t.stream());
      //send it out to consoler using that tasks tag(its secret identification number :p )
      this.Task.clone(t,'io.out');

      //create a reply from the tasks,this is a fancy way of making the reply tag the task uuid,and nothing else
      //it allows anyone to listen in if there will be a reply for these particular tasks,its not different from
      //doing:
      //  this.Reply.make(t.UUID,{'result':'socker'});
      this.Reply.from(t,{'result':'it was smoked!'});
    };

    var eater = plug.Plug.make(function(id,task){
      if(id === 'data.muncher'){ return true; };
      return false; 
    });

    //eater.$bind <- just a instance to bind function to object 'eater'
    eater.tasks().on(eater.$bind(function(t){
      //our imaginery global Muncher object with a eatUp function, totally a bad idea to do this for any code
      this.$bind(eatUp(t));
    }));

    //send it in directly for fun
    eater.tasks(plug.TasksPackets.make('data.muncher',{ name: 'die' }).emit('totally').emit('not gonna die!'));

  ```

  ... *lets combine them into a network*


  ```javascript


    var grid = plug.Network.make('my-grid');

    //supply the plug and the custom name ,since its gets stored in a hash. { 'my.eater': Plug }
    grid.use(eater,'my.eater');
    grid.use(consoler,'my.consoler');


    //send tasks into the network stream
    var toout = plug.TaskPackets.make('io.out',{name: 'charles'}).emit('I done care!');
    //create a channel and listen for a reply with the UUID as its id for the tasks from the network
    var toOutResult = gride.emitWatch(toout);
    toOutResult.on(console.log); // console.log the reply


    // send another
    var todead = grid.Task.make('data.muncher',{ id: '32223-not'});

  ```

 All plug identify tasks that they can handle by the task tag/id, if it doesnt match, it doesnt care.
## Projects

  * [Web.Plug](https://github.com/influx6/web.plug): Provides plugs for server side tasks such as routing and request handling,..etc

  * [Fs.Plug](https://github.com/influx6/fs.plug): Provides plugs for file system operations such file reading and writing,..etc

  * [LoveDb](https://github.com/influx6/lovedb): Provides plugs based on the idea of self promoting database that includes streaming updates and changes for all operations,i.e a oplog database stack on top of existing database using the [Quero](https://github.com/influx6/quero) project.


##Glossary

  * Read up on [flux][fluxURL]



[npm-url]: https://www.npmjs.org/package/plugd
[fluxURL]: http://facebook.github.io/react/blog/2014/05/06/flux.html
