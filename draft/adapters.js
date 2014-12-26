
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
    this.on(t.dispatch);
    this.plugs.push(t);
    return this;
  },
  detachPlug: function (t) {
    if(!Plug.isInstance(t) || !this.hasPlug(t)) return this;
    this.plugs[this.plugs.indexOf(t)] = null;
    t.channels.tasks.off(this.delegate);
    this.off(t.dispatch);
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
