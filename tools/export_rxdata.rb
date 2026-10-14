require 'json'
require 'fileutils'
module RPG; end
class Color
  attr_accessor :red,:green,:blue,:alpha
  def self._load(s); vals=s.unpack('E*'); o=allocate; o.red,o.green,o.blue,o.alpha=vals; o; end
end
class Tone
  attr_accessor :red,:green,:blue,:gray
  def self._load(s); vals=s.unpack('E*'); o=allocate; o.red,o.green,o.blue,o.gray=vals; o; end
end
class Table
  attr_accessor :xsize, :ysize, :zsize, :data
  def self._load(s)
    b=s.bytes
    ndim = b[0,4].pack('C*').unpack1('V')
    dims = b[4, 12].pack('C*').unpack('V*')
    count = b[16,4].pack('C*').unpack1('V')
    t=allocate
    t.xsize=dims[0] || 0; t.ysize=dims[1] || 1; t.zsize=dims[2] || 1
    t.data = b[20, count*2].to_a.each_slice(2).map{|a| ((a[0]||0) | ((a[1]||0)<<8)) >= 32768 ? ((a[0]||0)|((a[1]||0)<<8))-65536 : ((a[0]||0)|((a[1]||0)<<8)) }
    t
  rescue
    allocate
  end
end

def ensure_const_path(name)
  parts=name.split('::'); cur=Object
  parts.each_with_index do |p,j|
    if j < parts.length-1
      cur.const_set(p, Module.new) unless cur.const_defined?(p,false)
      cur=cur.const_get(p,false)
    else
      cur.const_set(p, Class.new) unless cur.const_defined?(p,false)
    end
  end
end

def load_rx(path)
  100.times do
    begin
      return Marshal.load(File.binread(path))
    rescue ArgumentError => e
      if e.message =~ /undefined class\/module ([\w:]+)/
        ensure_const_path($1)
      else
        raise
      end
    end
  end
  raise "too many unresolved classes in #{path}"
end

def convert(v)
  case v
  when NilClass, TrueClass, FalseClass, Numeric then v
  when String
    v.force_encoding('UTF-8')
    v.valid_encoding? ? v : v.scrub("�")
  when Array then v.map{|x| convert(x)}
  when Hash then v.each_with_object({}){|(k,x),h| h[convert(k).to_s]=convert(x)}
  else
    if v.is_a?(Color)
      {'_class'=>'Color','red'=>v.red,'green'=>v.green,'blue'=>v.blue,'alpha'=>v.alpha}
    elsif v.is_a?(Tone)
      {'_class'=>'Tone','red'=>v.red,'green'=>v.green,'blue'=>v.blue,'gray'=>v.gray}
    elsif v.is_a?(Table)
      {'_class'=>'Table','xsize'=>v.xsize,'ysize'=>v.ysize,'zsize'=>v.zsize,'data'=>v.data}
    else
      h={'_class'=>v.class.name}
      v.instance_variables.each{|iv| h[iv.to_s.sub('@','')]=convert(v.instance_variable_get(iv))}
      h
    end
  end
end
src=ARGV[0]; dst=ARGV[1]
FileUtils.mkdir_p(dst)
Dir.glob(File.join(src,'Data','*.rxdata')).sort.each do |f|
  next if File.basename(f) == 'Scripts.rxdata' # exported separately as readable Ruby sources
  begin
    x=load_rx(f)
    out=File.join(dst,File.basename(f,'.rxdata')+'.json')
    File.write(out,JSON.pretty_generate(convert(x)))
    puts "#{File.basename(f)} -> #{File.size(out)} bytes"
  rescue Exception=>e
    warn "FAILED #{f}: #{e.class}: #{e.message}"
  end
end
