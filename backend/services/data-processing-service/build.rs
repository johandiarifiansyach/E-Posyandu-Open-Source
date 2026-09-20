// SPDX-License-Identifier: GPL-3.0-or-later


fn main() {
    println!("cargo:rerun-if-changed=proto/data_processing.proto");
}
