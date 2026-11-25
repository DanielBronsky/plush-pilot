import { TextStyle } from 'pixi.js';
import { CONFIG } from '../config';

export const UI = {
  ink: 0x22263a,
  white: 0xffffff,
  yellow: 0xffcf3f,
  yellowDark: 0xd9a514,
  green: 0x4cd07d,
  greenDark: 0x2f9e58,
  red: 0xff5a5f,
  grey: 0x9aa3b5,
  panel: 0xffffff,
  panelShade: 0xdfe5f0,
  heart: 0xff4d6d,
  star: 0xffc93c,
  starEmpty: 0xcfd6e4,
};

export function textStyle(
  size: number,
  color: number = UI.white,
  weight: '700' | '800' | '900' = '800',
): TextStyle {
  return new TextStyle({
    fontFamily: CONFIG.ui.fontFamily,
    fontSize: size,
    fontWeight: weight,
    fill: color,
    align: 'center',
  });
}
