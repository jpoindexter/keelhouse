use libghostty_vt::terminal::{Options, Point, PointCoordinate, Terminal};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::io::Read;

fn main() {
    let cols: u16 = 80;
    let rows: u16 = 24;

    // Real pty, real process — this is the same primitive that would host
    // `claude` or `codex` in the actual app.
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .expect("open pty");

    // -G enables color on macOS/BSD ls; -la for varied output (dirs, files, perms).
    let mut cmd = CommandBuilder::new("ls");
    cmd.args(["-la", "-G"]);
    cmd.cwd(".");
    let mut child = pair.slave.spawn_command(cmd).expect("spawn ls");
    drop(pair.slave);

    let mut reader = pair.master.try_clone_reader().expect("clone reader");
    let mut raw = Vec::new();
    reader.read_to_end(&mut raw).expect("read pty output");
    child.wait().expect("wait for ls");

    println!("--- raw bytes from real pty (includes ANSI color codes) ---");
    println!("{} bytes captured", raw.len());
    println!("{:?}", String::from_utf8_lossy(&raw[..raw.len().min(120)]));

    // Real Ghostty engine parses it — not a hand-rolled parser.
    let mut term = Terminal::new(Options {
        cols,
        rows,
        max_scrollback: 1000,
    })
    .expect("create terminal");
    term.vt_write(&raw);

    println!("\n--- parsed by libghostty-vt (real Ghostty engine) ---");
    println!("cols={:?} rows={:?}", term.cols(), term.rows());

    let mut buf = [' '; 8];
    for y in 0..rows.min(10) {
        let mut line = String::new();
        for x in 0..cols {
            let point = Point::Active(PointCoordinate { x, y: y as u32 });
            if let Ok(grid_ref) = term.grid_ref(point) {
                if let Ok(n) = grid_ref.graphemes(&mut buf) {
                    if n > 0 {
                        line.push(buf[0]);
                    } else {
                        line.push(' ');
                    }
                } else {
                    line.push(' ');
                }
            }
        }
        println!("{:2} | {}", y, line.trim_end());
    }
}
