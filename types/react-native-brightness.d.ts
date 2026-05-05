declare module 'react-native-brightness' {
  export default class Brightness {
    static getBrightness(): Promise<number>;
    static setBrightness(value: number): Promise<void>;
    static getSystemBrightness(): Promise<number>;
    static setSystemBrightness(value: number): Promise<void>;
  }
}
