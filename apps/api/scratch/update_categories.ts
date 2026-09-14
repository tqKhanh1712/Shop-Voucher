import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    console.log('1. Đổi tên Ẩm thực & Đồ uống thành Đồ ăn...');
    const foodCat = await prisma.voucherCategory.findFirst({
      where: { code: { in: ['FOOD_DRINK', 'FOOD'] } }
    });

    if (foodCat) {
      await prisma.voucherCategory.update({
        where: { categoryId: foodCat.categoryId },
        data: { nameVi: 'Đồ ăn', code: 'FOOD' }
      });
      console.log('=> Đã đổi thành Đồ ăn');
    }

    console.log('2. Tạo danh mục gốc Nước uống...');
    let beverageCat = await prisma.voucherCategory.findFirst({
      where: { code: 'BEVERAGE' }
    });
    
    if (!beverageCat) {
      beverageCat = await prisma.voucherCategory.create({
        data: {
          code: 'BEVERAGE',
          nameVi: 'Nước uống',
          parentId: null,
          displayOrder: 15,
          isActive: true
        }
      });
      console.log('=> Đã tạo Nước uống');
    } else {
      console.log('=> Nước uống đã tồn tại');
    }

    console.log('3. Di chuyển Cà phê - Trà sang Nước uống...');
    const coffeeCat = await prisma.voucherCategory.findFirst({
      where: { nameVi: 'Cà phê - Trà' }
    });
    if (coffeeCat && beverageCat) {
      await prisma.voucherCategory.update({
        where: { categoryId: coffeeCat.categoryId },
        data: { parentId: beverageCat.categoryId }
      });
      console.log('=> Đã di chuyển Cà phê - Trà sang Nước uống');
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
