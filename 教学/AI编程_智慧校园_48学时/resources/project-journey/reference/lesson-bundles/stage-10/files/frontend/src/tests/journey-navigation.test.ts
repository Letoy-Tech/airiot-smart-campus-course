import { beforeEach, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FullWorkspace from '../views/FullWorkspace.vue'
const context=vi.hoisted(()=>({capabilities:{canRead:true,canAdmin:false as unknown,canAudit:false as unknown}}))
vi.mock('../stores/campus',()=>({useCampusStore:()=>context}))
vi.mock('../journey/registry',()=>({pages:[['devices','设备','03'],['audit','审计','10']],components:{devices:{template:'<div>设备</div>'},audit:{template:'<div>审计</div>'}},defaultPage:'devices'}))
beforeEach(()=>{location.hash='';context.capabilities.canAdmin=false;context.capabilities.canAudit=false})
it('查看者与字符串能力都不能看到审计导航',()=>{context.capabilities.canAdmin='true';context.capabilities.canAudit=true;const page=mount(FullWorkspace);expect(page.find('[data-testid="nav-audit"]').exists()).toBe(false);page.unmount()})
it('管理员同时具有严格审计能力时显示入口',()=>{context.capabilities.canAdmin=true;context.capabilities.canAudit=true;const page=mount(FullWorkspace);expect(page.find('[data-testid="nav-audit"]').exists()).toBe(true);page.unmount()})
