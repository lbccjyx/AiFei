/**
 * Effect elements — motion wrappers that *attach* to a page element and give
 * it a physical effect: follow (magnetic), tilt, drag-and-spring, 3D flip,
 * plus scroll/mount entrances (Reveal / FlipIn).
 *
 *   <Magnetic><Button>Follow</Button></Magnetic>
 *   <Tilt><Card>…</Card></Tilt>
 *   <Drag><div>Drag me</div></Drag>
 *   <Flip front={…} back={…} trigger="click" />
 */
import './effects.css';

export { default as Magnetic } from './Magnetic';
export type { MagneticProps } from './Magnetic';
export { default as Tilt } from './Tilt';
export type { TiltProps } from './Tilt';
export { default as Drag } from './Drag';
export type { DragProps } from './Drag';
export { default as Flip } from './Flip';
export type { FlipProps } from './Flip';
export { default as Reveal } from './Reveal';
export type { RevealProps } from './Reveal';
export { default as FlipIn } from './FlipIn';
export type { FlipInProps } from './FlipIn';
