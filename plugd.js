var stacks = require("stackq");

var MessagePicker = function(n){ return n['message']; };
var inNext = function(n,e){ return n(); };
var tasks = 0x24677B434A323;
var replies = 0x1874F43FF45;
var packets = 0x1874F43FF45;

var PacketSchema = stacks.Schema({},{
    message: 'string',
    stream: 'StreamSelect',
    tag: 'number',
    uuid: 'string',
    cid: packets,
    'origin?':'string',
  },{
    uuid:{
      maxWrite: 1,
    },
    stream:{
      maxWrite: 1,
    },
    cid:{
      copy: true,
    },
    tag:{
      maxWrite: 1,
    },
    message:{
      maxWrite: 1,
    },
  },{
  StreamSelect: function(f,fn){
    return fn(stacks.StreamSelect.isType(f));
  }
});

var Packets = exports.Packets = function(id,tag){
  var shell = PacketSchema.extends({});
  shell.tag = tag;
  shell.message = id;
  shell.stream = stacks.StreamSelect.make();
  shell.emit = stacks.funcs.bind(shell.stream.emit,shell.stream);
  shell.uuid = stacks.Util.guid();
  return shell;
};

Packets.isPacket = function(p){
 if(p.cid && p.cid == packets) return true;
 return false;
};

Packets.isTask = function(p){
 if(Packets.isPacket(p) && p.tag == tasks) return true;
 return false;
};

Packets.isReply = function(p){
 if(Packets.isPacket(p) && p.tag == replies) return true;
 return false;
};

Packets.Task = function(id){
  var bs = Packets(id,tasks);
  bs.stream.mutts.add(function(f,next,end){
    if(!stacks.valids.exists(f['uuid']) && !stacks.valids.exists(f['data'])) return;
    return next();
  });
  return bs;
};

Packets.Reply = function(id){
  return Packets(id,replies);
};

var ShellPacket = exports.ShellPacket = function(pack){
  if(!Packets.isPacket(pack)) return;
  return stacks.UntilShell(function(f){
    pack.stream.emit(f);
  },function(d){
    pack.stream.lock();
    d.distribute(pack);
  });
};

ShellPacket.withTask = function(p){
 if(!Packets.isTask(p)) return;
 return ShellPacket(Pac);
};

ShellPacket.withReply = function(p){
 if(!Packets.isReply(p)) return;
 return ShellPacket(p);
};

ShellPacket.Task = function(id){
 return ShellPacket(Packets.Task(id));
};

ShellPacket.Reply = function(id){
 return ShellPacket(Packets.Reply(id));
};

var Channel = exports.Channel = stacks.Stream.extends({});

var SelectedChannel = exports.SelectedChannel = Channel.extends({
  init: function(id,picker){
    this.$super();
    this.contract = stacks.Contract(id,picker);
    this.contract.onPass(stacks.funcs.bind(this.mutts.emit,this.mutts));
  },
  emit: function(d){
    this.contract.interogate(d);
  }
});

var TaskChannel = exports.TaskChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isTask(f)) return;
      return next();
    });
  }
});

var ReplyChannel = exports.ReplyChannel = SelectedChannel.extends({
  init: function(id,picker){
    this.$super(id,picker || MessagePicker);
    this.mutts.add(function(f,next,end){
      if(!Packets.isReply(f)) return;
      return next();
    });
  }
});

var Adaptor = exports.Adaptor = stacks.Class({
  init: function(fn){
    stacks.Asserted(stacks.valids.isFunction(fn),"argument must be a function!");

    this.plugs = [];
    this.nextLinks = {};
    this.route = stacks.Distributors();
    this.delegate = this.$closure(function(t){
      if(!Packets.isPacket(t)) return;
      return fn.call(this,t);
    });

    this.mux = stacks.Middleware(this.$closure(function(t){
      return this.route.distributeWith(this,[t]);
    }));

    this.mux.add(function(d,next,end){
      if(!Packets.isPacket(d)) return;
      return next();
    });

  },
  attachPlug: function(t){
    if(!Plug.isInstance(t)) return this;
    t.channels.tasks.on(this.delegate);
    this.on(t.$scoped('dispatch'));
    this.plugs.push(t);
    return this;
  },
  detachPlug: function (t) {
    if(!Plug.isInstance(t) || !this.hasPlug(t)) return this;
    this.plugs[this.plugs.indexOf(t)] = null;
    t.channels.tasks.off(this.delegate);
    this.off(t.$scoped('dispatch'));
    stacks.Util.normalizeArray(this.plugs);
    return this;
  },
  nextAdaptor: function(apt,ifn){
    intercepter = (util.isFunction(ifn) ? ifn : inNext);
    var filter = function(t,next,end){
      apt.delegate(t);
      return intercepter(next,end);
    };
    this.nextLinks[apt] = filter;
    this.mux.add(filter);
    return this;
  },
  yankAdapter: function(apt){
    var filter = this.nextLinks[apt];
    if(filter) this.mux.remove(filter);
    return this;
  },
  send: function (t) {
    this.mux.emit(t);
    return this;
  },
  sendReply: function(id){
    var self = this,s = ShellPacket.Reply(id);
    s.once(function(f){
      self.send(f);
    });
    return s;
  },
  hasPlug: function (t) {
      return this.plugs.indexOf(t) != -1;
  },
  on: function (t) {
    this.route.add(t);
    return this;
  },
  once: function (t) {
    this.route.addOnce(t);
    return this;
  },
  off: function (t) {
    this.route.remove(t);
    return this;
  },
  offOnce: function (t) {
    return this.off(t);
  },
});

var AdapterWorkQueue = exports.AdapterWorkQueue = stacks.Class({
  init: function(){
    this.adaptors = [];
  },
  queue: function (q) {
    if(!(Adapter.isInstance(q))) return null;
    var first = stacks.enums.last(this.adaptors);
    this.adaptors.push(q);
    if (!!first) {
      first.listen(q.delegate);
    }
  },
  unqueue: function (q) {
    if(!Adapter.isInstance(q) || !this.has(q)) return null;
    var index = this.adaptors.indexOf(q),
    pid = index - 1, nid = index + 1,
    pa = this.adaptors[pid], na = this.adaptors[nid];

    if(!!pa) {
      pa.unlisten(q.delegate);
      if(!!na) {
        q.unlisten(na.delegate);
        pa.listen(na.delegate);
      }
    }

    this.adaptors[index] = null;
    stacks.Util.normalizeArray(this.adaptors);
  },
  has: function (q) {
    if(!(q instanceof Adapter)) return null;
      return this.adaptors.indexOf(q) != -1;
  },
  isEmpty: function () {
    return this.adaptors.length <= 0;
  },
  emit: function (d) {
    if (this.isEmpty) return null;
    var fst = stacks.enums.first(this.adaptors);
    fst.delegate(d);
  },
});

var PSMeta = { task: true, reply: true};
var PackStream = exports.PackStream = stacks.Class({
  init: function(ids,picker,mets){
    stacks.Asserted(stacks.valids.isObject(ids),'first agrument must be an object');
    stacks.Asserted(stacks.valids.exists(ids['task']),ids+' must have a "task" attribute');
    stacks.Asserted(stacks.valids.exists(ids['reply']),ids+' must have a "reply" attribute');
    var meta = stacks.Util.extends({},PSMeta,mets);
    this.packets = Channel.make();
    if(meta.task){
      this.tasks = TaskChannel.make(ids.task,picker);
      this.packets.stream(this.tasks);
    }
    if(meta.reply){
      this.replies = ReplyChannel.make(ids.reply,picker);
      this.packets.stream(this.replies);
    }
  },
  mutts: function(){
    return this.packets.mutts;
  },
  emit: function(f){
    if(!Packets.isPacket(f)) return;
    return this.packets.emit(f);
  },
  stream: function(sm){
    return this.packets.stream(sm);
  },
  unstream: function(sm){
    return this.packets.unstream(sm);
  },
  streamTask: function(sm){
    return this.tasks.stream(sm);
  },
  unstreamTask: function(sm){
    return this.tasks.unstream(sm);
  },
  streamReplies: function(sm){
    return this.replies.stream(sm);
  },
  unstreamReplies: function(sm){
    return this.replies.unstream(sm);
  },
});

var Plug = exports.Plug = stacks.Class({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),"first argument must be a string");
    this.channels = PackStream.make({task: id, reply: stacks.funcs.always(true)},MessagePicker);
    this.plates = {};
    this.id = id;
  },
  hasPlate: function(plate){
    return stacks.valids.exists(this.plates[plate]);
  },
  attachPlate: function(plate){
    if(this.hasPlate(plate)) return;
    var sub = plate.channels.stream(this.channels.packets);
    this.plates[plate] = sub;
  },
  detachPlate: function(plate){
    if(this.boundedPlates[plate]) this.boundedPlates[plate].unstream();
  },
  dispatch: function (t) {
    this.channels.emit(t);
  },
  dispatchTask:  function (id) {
    stacks.Asserted(valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Task(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    return mesg;
  },
  dispatchReply:  function (id) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Reply(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    return mesg;
  },
});

var Plate = exports.Plate = stacks.Class({
  init: function(id) {
    var fx = stacks.funcs.always(true);
    this.channels = PackStream.make({ reply: fx, task: fx });
    this.id = id;
  },
  plug: function(id){
    var pl =  Plug.make(id);
    pl.attachPlate(this);
    return pl;
  },
  plugQueue: function(){
    return new PlugQueue(this);
  },
  dispatch: function (t) {
    this.channels.emit(t);
  },
  dispatchReply:  function (id) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Reply(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    return mesg;
  },
  dispatchTask:  function (id,uuid,data) {
    stacks.Asserted(stacks.valids.exists(id),"id is required (id)");
    var self = this, mesg = ShellPacket.Task(id);
    mesg.once(function(f){
      self.dispatch(f);
    });
    if(stacks.valids.exists(data) && stacks.valids.exists(uuid)){
      mesg.push({'uuid': uuid, data: data});
    }
    return mesg;
  },
  watch: function(uuid){
    var channel = new channels.SelectedChannel(uuid, MessagePicker);
    this.channel.subscriber = this.channels.stream(channel);
    return channel;
  },
  task: function (id, uuid, data) {
    var task = this.watch(uuid);
    task.task = this.disptachTask(id,uuid,data);
    return task;
  },
});

var PlugQueue = exports.PlugQueue = stacks.Class({
  init: function(pl){
    stacks.Asserted(stacks.valids.isInstanceOf(pl,Plate),"argument must be an instance of plate");
    this.plate = pl;
    this.typeList = {};
    this.wq = stacks.WorkQueue();
    this.active = stacks.Switch();

    this.onDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
    this.onDoneOnce = stacks.funcs.bind(this.wq.done.addOnce,this.wq.done);
    this.offDone = stacks.funcs.bind(this.wq.done.add,this.wq.done);
  },
  peek: function(fn){
    this.wq.queue(fn);
  },
  queue: function(name,uuid){
    var self = this,
    guid = uuid || [name,stacks.Util.guid()].join(':'),
    chan = this.plate.watch(guid);
    chan.__guid = guid;

    if(this.typeList[guid]) return guid;

    this.typeList[guid] = ({
      'plug':name,
      'uuid': guid,
      'index': this.typeList.length,
      'watch':chan,
      'fn': stacks.funcs.bind(function(f){
        return this.plate.dispatchMessage(name,guid,f);
      },self)
    });

    return chan;
  },
  unqueue: function(pl){
    if(!this.has(pl)) return null;
    this.typeList[pl] = null;
  },
  has: function(n){
    return !!this.typeList[n];
  },
  __pack: function(){
    var self = this,e,m;
    for(m in this.typeList){
      e = this.typeList[m];
      if(stacks.Valids.notExists(e)) return;
      var plug = e['plug'],fn = e['fn'], chan = e['watch'];
      chan.once(function(f){ self.emit(f); });
      self.wq.queue(fn);
    };
    self.wq.queue(function(f){
      self.active.off();
    });
  },
  emit: function(f){
    if(!this.active.isOn()) this.__pack();
    this.active.on();
    return this.wq.emit(f);
  }
});

var PlugPoint = exports.PlugPoint = function(fx){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plug.isType(src)) return;

    var stm = stacks.Stream.make();

    var handle = function(r){
      return fn.call(null,r,stm);
    };

    src.channels.replies.on(handle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plug.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('close',function(){
      src.channels.replies.off(handle);
      return stm.close();
    });

    this.secureLock('plug',function(plug){
      if(!Plug.isType(plug)) return;
      this.stream(plug.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var PlatePoint = exports.PlatePoint = function(fx){
  if(!stacks.valids.isFunction(fx)) return;
  return stacks.MutateBy(function(fn,src,dests){
    if(!Plate.isType(src)) return;

    var stm = stacks.Stream.make();

    var handle = function(r){
      return fn.call(null,r,stm);
    };

    src.channels.replies.on(handle);

    stacks.enums.each(dests,function(e,i,o,ff){
      if(!Plate.isType(e)) return ff(null);
      stm.stream(e.channels.packets);
      return ff(null);
    });
    this.UUID = stacks.Util.guid();

    this.secure('close',function(){
      src.channels.replies.off(handle);
      return stm.close();
    });

    this.secureLock('plate',function(plate){
      if(!Plate.isType(plate)) return;
      this.stream(plate.channels.packets);
    });

    this.secure('stream',function(sm){
      stm.stream(sm);
    });

    this.secure('tap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    this.secure('untap',function(fn,name){
      if(stacks.valids.isString(name)) return stm.onEvent(name,fn);
      stm.on(fn);
    });

    // this.lock();
  },fx);
};

var Store = exports.Store = stacks.FunctionStore.extends({
  register: function(){ return this.add.apply(this,arguments); },
  unregister: function(){ return this.remove.apply(this,arguments); },
});

var PlugPointStore = exports.PlugPointStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      return PlugPoint(fn);
    });
  }
});

var PlatePointStore = exports.PlugPointStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      return PlatePoint(fn);
    });
  }
});

var PlugStore = exports.PlugStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      var plug = Plug.make(sid);
      fn.call(plug);
      return plug;
    });
  }
});

var AdaptorStore = exports.AdaptorStore = Store.extends({
  init: function(id){
    this.$super(id,function(fn,sid){
      var apt = Adaptor.make(fn);
      apt._apt_id = sid;
      return apt;
    });
  }
})

var Compose = exports.Compose = stacks.Class({
  init: function(id,plugs,adaptors,points){
    stacks.Asserted(stacks.valids.isString(id),'first argument supplied must be a string');
    stacks.Asserted(PlugStore.isInstance(plugs),'2nd argument supplied must be a PlugStore instance');
    stacks.Asserted(AdaptorStore.isInstance(adaptors),'3rd argument supplied must be a AdaptorStore instance');
    stacks.Asserted(PlugPointStore.isInstance(points),'4rd argument supplied must be a AdaptorStore instance');
    this.id = id;
    this.plates = Plate.make(id);
    this.plugRegistry = plugs;
    this.adaptorRegistry = adaptors;
    this.pointRegistry = points;
    this.plugs = stacks.Storage.make();
    this.points = stacks.Storage.make();
    this.adaptors = stacks.Storage.make();
  },
  usePlug: function(id,gid){
    stacks.Asserted(stacks.valids.isString(id),'first argument is the store "id" of the plug');
    if(this.plugRegistry.has(id) && !this.plugs.has(gid)){
      var pl = this.plugRegistry.Q(id);
      this.plugs.add(gid || pl.GUUID,pl);
      pl.attachPlate(this.plates);
    }
    return this;
  },
  usePoint: function(id,gid){
    stacks.Asserted(stacks.valids.isString(id),'first argument is the store "id" of the plug');
    if(this.pointRegistry.has(id) && !this.points.has(gid)){
      var pl = this.pointRegistry.Q(id);
      this.points.add(gid || pl.GUUID,pl);
    }
    return this;
  },
  plug: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.plugs.Q(gid);
  },
  point: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.points.Q(gid);
  },
  plugQueue: function(){
    return this.plate.plugQueue();
  }
 },
 {
    create: function(id){
      return Compose.make(id,PlugStore.make(id),AdaptorStore.make(id),PlugPointStore.make(id))
    }
});

var Composer = exports.Composer = stacks.Class({
  init: function(id){
    stacks.Asserted(stacks.valids.isString(id),'first argument supplied must be a string');
    this.id = id;
    this.composed = stacks.Storage.make();
    this.points = stacks.Storage.make();
    this.plugs = PlugStore.make();
    this.adaptors = AdaptorStore.make();
    this.platePoints = PlatePointStore.make();
    this.plugPoints = PlugPointStore.make();
  },
  useCompose: function(id){
    if(this.composed.has(id)) return;
    var com = Compose.make(id,this.plugs,this.adaptors,this.plugPoints);
    this.composed.add(id || com.GUUID,com);
    return com;
  },
  usePoint: function(id,gid){
    stacks.Asserted(stacks.valids.isString(id),'first argument is the store "id" of the plug');
    if(this.platePoints.has(id) && !this.points.has(gid)){
      var pl = this.platePoints.Q(id);
      this.points.add(gid || pl.GUUID,pl);
    }
    return this;
  },
  compose: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.composed.Q(gid);
  },
  point: function(gid){
    stacks.Asserted(stacks.valids.isString(gid),'argument is the unique alias for this plug');
    return this.points.Q(gid);
  },
});
