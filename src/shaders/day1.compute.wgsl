const n: u32 = $<WORKGROUP_SIZE>;

var<workgroup> first_digit: array<u32, n>;
var<workgroup> last_digit: array<u32, n>;
var<workgroup> number: array<u32, n>;

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read_write> output: array<f32>;

@compute @workgroup_size(n, 1, 1) 
fn first_last_digit(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_id) local_id: vec3<u32>
) {
  // t_id is the index of this thread's character within the line
  // each thread is responsible for 2 characters
  var t_id = local_id.x;
  // offset in global buffer, each line is 2n long
  var offset = workgroup_id.x * 2 * n;


  // i is the index of this thread's character within the entire input
  // each line is 2n long (thread dispatch is 1/2 the line length)
  var i = 2 * t_id;

  // load this thread's character and the one next to it
  var a = input[i + offset];
  var b = input[i + 1 + offset];

  // compare, and set the corresponding digit (first/last) in the workgroup buffers
  if (is_digit(a) && is_digit(b)) {
    first_digit[t_id] = a;
    last_digit[t_id] = b;
  } else if (is_digit(a)) {
    first_digit[t_id] = last_digit[t_id] = a;
  } else if (is_digit(b)) {
    first_digit[t_id] = last_digit[t_id] = b;
  } else {
    first_digit[t_id] = last_digit[t_id] = 0;
  }

  // sync
  workgroupBarrier();

  // do reduction
  for (var stride: u32 = 1; stride < n; stride *= 2) {
    i = 2 * stride * t_id;
    if (i < n) {
      // check first digits first
      a = first_digit[i];
      b = first_digit[i + stride];

      if (is_digit(a)) {
        first_digit[t_id] = a;
      } else {
        first_digit[t_id] = b;
      }

      // last digit
      a = last_digit[i];
      b = last_digit[i + stride];

      if (is_digit(b)) {
        last_digit[t_id] = b;
      } else {
        last_digit[t_id] = a;
      }
    }

    // sync
    workgroup_barrier();
  }

  // if this is the first thread, combine digits
  if (t_id == 0) {
    output[workgroup_id.x] = combine_digits(first_digit[0], last_digit[0]);
  }
}

fn is_digit(x: u32) -> bool {
  return x >= 48 && x <= 57;
}

fn combine_digits(first: u32, last: u32) -> u32 {
  var a = first - 48;
  var b = last - 48;
  return a * 10 + b;
}
