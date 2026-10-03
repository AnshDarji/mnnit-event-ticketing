import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/" aria-label="CampusPass home">
    <Image className="brand-institute-logo" src="/mnnit-logo.png" alt="MNNIT Allahabad emblem" width={379} height={512} unoptimized loading="eager" />
    <span>Campus<span className="brand-pass">Pass</span><small>MNNIT ALLAHABAD</small></span>
  </Link>;
}
