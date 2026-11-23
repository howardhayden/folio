"""Read the singleton GitHub Pages TAR without extracting files or printing metadata."""
import io
import stat
import sys
from zipfile import BadZipFile, ZipFile, ZIP_DEFLATED, ZIP_STORED


def read_pages_tar(archive):
    if not 0 < len(archive) <= 12 * 1024 * 1024:
        raise ValueError("Pages ZIP size")
    with ZipFile(io.BytesIO(archive)) as pages:
        rows = pages.infolist()
        if len(rows) != 1:
            raise ValueError("Pages ZIP member count")
        entry = rows[0]
        if (entry.orig_filename != "artifact.tar" or entry.filename != entry.orig_filename
                or entry.is_dir() or stat.S_IFMT(entry.external_attr >> 16) not in (0, stat.S_IFREG)
                or entry.flag_bits & 1 or entry.compress_type not in (ZIP_STORED, ZIP_DEFLATED)):
            raise ValueError("Pages ZIP member type")
        if not 1024 <= entry.file_size <= 64 * 1024 * 1024 or entry.file_size % 512:
            raise ValueError("Pages TAR size")
        data = pages.read(entry)  # Reading through EOF verifies the member CRC.
        if len(data) != entry.file_size:
            raise ValueError("Pages TAR length")
        return data


if __name__ == "__main__":
    try:
        sys.stdout.buffer.write(read_pages_tar(sys.stdin.buffer.read(12 * 1024 * 1024 + 1)))
    except (ValueError, BadZipFile, OSError):
        sys.exit("G06 Pages ZIP verification failed")
