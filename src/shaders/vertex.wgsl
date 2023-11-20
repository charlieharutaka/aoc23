@group(0) @binding(0) var<uniform> uTime: f32;

const pi = radians(180.0);

struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
};

@vertex
fn vs(@location(0) pos: vec2f, @location(1) color: vec4f) -> VertexOut {
  var out: VertexOut;
  out.pos = vec4f(pos.x * sin(uTime/1000.0), pos.y, 0, 1);
  out.color = color;
  return out;
}
