import config from '../config/instance.json' with {type:'json'};
import {validateInstance} from './instance-config.mjs';
export const INSTANCE=validateInstance(config);
