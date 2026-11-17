import {expect,type Page} from '@playwright/test';
/** Explicit player-paced orientation, then an optional skip of the arrival animation. */
export async function finishJourneyTravel(page:Page):Promise<void>{
 const go=page.locator('[data-ui=journey-travel-go]');
 if(await go.isVisible())await go.click();
 const skip=page.getByRole('button',{name:'Passer la scène',exact:true});
 if(await skip.isVisible())await skip.click();
 await expect(page.locator('main.journey')).not.toHaveAttribute('data-acting','true');
}
