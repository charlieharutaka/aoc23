const workgroup_len: u32 = $<WORKGROUP_SIZE>;
var<workgroup> workgroup_data: array<f32, workgroup_len>;

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(workgroup_len, 1, 1)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // each thread loads one element from global to shared mem
  var t_id = local_id.x;
  var i = workgroup_id.x * workgroup_len + t_id;
  workgroup_data[t_id] = input[i];

  workgroupBarrier();

  // do reduction in shared mem
  for (var s: u32 = 1; s < workgroup_len; s *= 2) {
    if (t_id % (2 * s) == 0) {
      workgroup_data[t_id] += workgroup_data[t_id + s];
    }

    workgroupBarrier();
  }

  // write result for this block to global mem
  if (t_id == 0) {
    output[workgroup_id.x] = workgroup_data[0];
  }
}
